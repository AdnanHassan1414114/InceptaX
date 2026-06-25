/**
 * utils/repoFileWalker.js
 *
 * Walks a cloned repository directory and returns the list of files worth
 * analyzing — skipping dependency folders, build output, binaries, and
 * anything too large to be useful in an evaluation prompt.
 *
 * This is a separate, small file from repoCloneService.js on purpose:
 * cloning is "how do I get the repo," walking is "which parts of the repo
 * matter." Keeping them apart means each one stays a single concern you
 * can describe in one sentence.
 */

const fs = require('fs/promises');
const path = require('path');

const MAX_FILE_SIZE_BYTES = parseInt(process.env.MAX_REPO_FILE_SIZE_BYTES || '100000', 10);

// Directories that never contain code worth evaluating
const SKIP_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', '.next', 'coverage',
  'vendor', '__pycache__', '.venv', 'venv', '.cache', 'out',
]);

// File extensions worth reading. Anything not in this list (images, fonts,
// binaries, lockfiles) is skipped — they add no evaluative signal and only
// cost embedding API calls.
const INCLUDE_EXTENSIONS = new Set([
  '.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs',
  '.py', '.java', '.go', '.rb', '.php', '.c', '.cpp', '.cs',
  '.json', '.md', '.yml', '.yaml', '.html', '.css', '.scss',
]);

/**
 * Recursively collects readable files under rootDir.
 *
 * @param {string} rootDir - absolute path to the cloned repo
 * @returns {Promise<Array<{ filePath: string, content: string }>>}
 *   filePath is RELATIVE to rootDir, e.g. "controllers/authController.js"
 */
async function collectFiles(rootDir) {
  const results = [];

  async function walk(currentDir) {
    let entries;
    try {
      entries = await fs.readdir(currentDir, { withFileTypes: true });
    } catch {
      return; // unreadable directory — skip silently, non-fatal
    }

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name) && !entry.name.startsWith('.')) {
          await walk(fullPath);
        }
        continue;
      }

      if (!entry.isFile()) continue;

      const ext = path.extname(entry.name).toLowerCase();
      if (!INCLUDE_EXTENSIONS.has(ext)) continue;

      let stat;
      try {
        stat = await fs.stat(fullPath);
      } catch {
        continue;
      }
      if (stat.size === 0 || stat.size > MAX_FILE_SIZE_BYTES) continue;

      let content;
      try {
        content = await fs.readFile(fullPath, 'utf8');
      } catch {
        continue; // likely a binary file misidentified by extension
      }

      results.push({
        filePath: path.relative(rootDir, fullPath).split(path.sep).join('/'),
        content,
      });
    }
  }

  await walk(rootDir);
  return results;
}

module.exports = { collectFiles };