/**
 * utils/codeChunker.js
 *
 * Splits a file's content into smaller "chunks" so each piece can be
 * individually embedded and retrieved later. This is a pure function —
 * no I/O, no API calls — which makes it easy to unit test and easy to
 * reason about in isolation.
 *
 * WHY NOT A FULL PARSER (e.g. tree-sitter / Babel AST):
 *   A real parser would split exactly at syntactic boundaries for every
 *   language, but that means pulling in a parsing library + grammar per
 *   language and handling edge cases (decorators, generics, JSX, etc).
 *   That's a lot of complexity for marginal gain here. Regex-based
 *   boundary detection gets ~90% of the value (chunks that are mostly
 *   intact functions, not mid-statement cuts) with about 30 lines of
 *   code that are fully explainable line-by-line.
 *
 * STRATEGY:
 *   1. For recognized code files, split at lines that look like the START
 *      of a function, class, or top-level export — these are strong,
 *      language-common signals of "a new logical unit is beginning."
 *   2. Each chunk runs from one boundary up to (but not including) the
 *      next boundary, or end of file.
 *   3. If a single chunk is too large (one huge function), it gets
 *      further split by blank-line groups as a fallback.
 *   4. Files with no recognized boundaries (JSON, markdown, config) are
 *      chunked by paragraph (blank-line-separated groups) instead.
 *
 * Every chunk keeps its filePath and line range so later prompts can say
 * "from controllers/authController.js lines 40-65" — this makes the LLM's
 * output traceable back to specific code, which is also a nice detail to
 * mention if asked about output quality in an interview.
 */

const MAX_CHUNK_CHARS = 1500;

// Lines matching any of these patterns mark the start of a new chunk.
// Covers the common cases across the languages INCLUDE_EXTENSIONS allows.
const BOUNDARY_PATTERNS = [
  /^\s*(export\s+)?(default\s+)?function\b/,        // function foo() / export function foo()
  /^\s*(export\s+)?(default\s+)?class\b/,            // class Foo / export class Foo
  /^\s*(export\s+)?const\s+\w+\s*=\s*(async\s*)?\(/, // const foo = (...) =>
  /^\s*(export\s+)?const\s+\w+\s*=\s*function\b/,    // const foo = function(...)
  /^\s*exports\.\w+\s*=/,                            // exports.foo = ...  (CommonJS, used throughout this codebase)
  /^\s*module\.exports\s*=/,                         // module.exports = ...
  /^\s*(async\s+)?def\s+\w+\s*\(/,                   // Python: def foo(...) / async def foo(...)
  /^\s*class\s+\w+/,                                 // Python/Java/etc: class Foo
];

const CODE_EXTENSIONS = new Set([
  '.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs',
  '.py', '.java', '.go', '.rb', '.php', '.c', '.cpp', '.cs',
]);

function getExtension(filePath) {
  const idx = filePath.lastIndexOf('.');
  return idx === -1 ? '' : filePath.slice(idx).toLowerCase();
}

function isBoundaryLine(line) {
  return BOUNDARY_PATTERNS.some((pattern) => pattern.test(line));
}

/**
 * Further splits an oversized chunk by blank-line groups so no single
 * chunk exceeds MAX_CHUNK_CHARS. Used as a fallback for very large
 * functions that wouldn't otherwise be split.
 */
function splitOversizedChunk(text, startLine) {
  if (text.length <= MAX_CHUNK_CHARS) {
    return [{ text, startOffset: 0 }];
  }

  const lines = text.split('\n');
  const pieces = [];
  let current = [];
  let currentLen = 0;
  let pieceStartLine = 0;

  lines.forEach((line, idx) => {
    current.push(line);
    currentLen += line.length + 1;

    const isBlank = line.trim() === '';
    const overSize = currentLen >= MAX_CHUNK_CHARS;

    if ((isBlank && overSize) || idx === lines.length - 1) {
      pieces.push({ text: current.join('\n'), startOffset: pieceStartLine });
      pieceStartLine = idx + 1;
      current = [];
      currentLen = 0;
    }
  });

  if (current.length) {
    pieces.push({ text: current.join('\n'), startOffset: pieceStartLine });
  }

  return pieces.filter((p) => p.text.trim().length > 0);
}

/**
 * Chunks a code file by splitting at function/class boundaries.
 */
function chunkCodeFile(content) {
  const lines = content.split('\n');
  const boundaryIndexes = [];

  lines.forEach((line, idx) => {
    if (isBoundaryLine(line)) boundaryIndexes.push(idx);
  });

  // No recognizable boundaries — treat the whole file as one chunk
  // (further size-split if needed) rather than discarding it.
  if (boundaryIndexes.length === 0) {
    return splitOversizedChunk(content, 0).map((piece) => ({
      chunkText: piece.text,
      startLine: piece.startOffset + 1,
      endLine: piece.startOffset + piece.text.split('\n').length,
    }));
  }

  const segments = [];
  for (let i = 0; i < boundaryIndexes.length; i++) {
    const start = boundaryIndexes[i];
    const end = i + 1 < boundaryIndexes.length ? boundaryIndexes[i + 1] : lines.length;
    segments.push({ start, end });
  }

  // Anything before the first boundary (imports, top-of-file comments)
  // becomes its own small chunk rather than being dropped.
  if (boundaryIndexes[0] > 0) {
    segments.unshift({ start: 0, end: boundaryIndexes[0] });
  }

  const chunks = [];
  for (const seg of segments) {
    const segText = lines.slice(seg.start, seg.end).join('\n');
    if (segText.trim().length === 0) continue;

    const pieces = splitOversizedChunk(segText, seg.start);
    for (const piece of pieces) {
      const absoluteStart = seg.start + piece.startOffset;
      chunks.push({
        chunkText: piece.text,
        startLine: absoluteStart + 1, // 1-indexed for human readability
        endLine: absoluteStart + piece.text.split('\n').length,
      });
    }
  }

  return chunks;
}

/**
 * Chunks a non-code file (JSON, markdown, config) by paragraph —
 * groups of lines separated by at least one blank line.
 */
function chunkTextFile(content) {
  const lines = content.split('\n');
  const paragraphs = [];
  let current = [];
  let currentStart = 0;

  lines.forEach((line, idx) => {
    if (line.trim() === '') {
      if (current.length) {
        paragraphs.push({ text: current.join('\n'), start: currentStart });
      }
      current = [];
      currentStart = idx + 1;
    } else {
      current.push(line);
    }
  });
  if (current.length) {
    paragraphs.push({ text: current.join('\n'), start: currentStart });
  }

  // Merge consecutive small paragraphs up to MAX_CHUNK_CHARS so we don't
  // end up with hundreds of tiny one-line chunks for a long README.
  const merged = [];
  let buffer = null;

  for (const p of paragraphs) {
    if (!buffer) {
      buffer = { text: p.text, startLine: p.start };
      continue;
    }
    if (buffer.text.length + p.text.length < MAX_CHUNK_CHARS) {
      buffer.text += '\n\n' + p.text;
    } else {
      merged.push(buffer);
      buffer = { text: p.text, startLine: p.start };
    }
  }
  if (buffer) merged.push(buffer);

  return merged.map((m) => ({
    chunkText: m.text,
    startLine: m.startLine + 1,
    endLine: m.startLine + m.text.split('\n').length,
  }));
}

/**
 * Main entry point. Chunks a single file's content based on its extension.
 *
 * @param {string} filePath - relative path, used only to pick a strategy
 * @param {string} content - the file's full text content
 * @returns {Array<{ chunkText: string, startLine: number, endLine: number }>}
 */
function chunkFile(filePath, content) {
  if (!content || content.trim().length === 0) return [];

  const ext = getExtension(filePath);
  const chunks = CODE_EXTENSIONS.has(ext)
    ? chunkCodeFile(content)
    : chunkTextFile(content);

  // Drop trivially small chunks (e.g. a lone closing brace left over from
  // splitting) — they add noise without adding evaluative signal.
  return chunks.filter((c) => c.chunkText.trim().length > 10);
}

module.exports = { chunkFile };
