/**
 * utils/embeddingService.js
 *
 * Converts text into an embedding vector (an array of numbers representing
 * meaning) using Google's Gemini embedding API.
 *
 * 🔹 CORRECTED — the model originally targeted here, text-embedding-004,
 * has been deprecated by Google in favor of gemini-embedding-001. That
 * model change has two real consequences this file must account for:
 *
 *   1. DIMENSION: gemini-embedding-001 defaults to 3072-dimensional
 *      output, not 768. Since the Postgres migration's column is
 *      declared as vector(768) (768 was kept deliberately — Google
 *      themselves note it's only a 0.26% quality loss vs the full 3072,
 *      at a quarter of the storage), every call below explicitly passes
 *      output_dimensionality: 768 so the API truncates its output to
 *      match. Without this parameter, every insert into repo_chunks
 *      would fail with a dimension-mismatch error from Postgres.
 *
 *   2. BATCHING: gemini-embedding-001's batchEmbedContents endpoint only
 *      accepts ONE input text per request — it does not support
 *      embedding many texts in a single call the way the older model
 *      did. embedBatch() below issues one request per chunk (run with
 *      limited concurrency, not all at once) instead of grouping many
 *      chunks into one request.
 *
 * 🔹 UPDATED — PARTIAL-FAILURE TOLERANCE
 *   Calling Gemini once per chunk means a single submission can require
 *   50-150 individual API calls. Across that many calls, hitting at
 *   least one transient failure (a momentary rate-limit hit, a network
 *   blip) is a realistic, expected occurrence — not a rare edge case.
 *
 *   The PREVIOUS version of this file used a plain Promise.all() to run
 *   the concurrent workers: the moment ANY single embedText() call
 *   threw, the whole Promise.all() rejected immediately, discarding
 *   every chunk that had already embedded successfully — even if 80+
 *   out of 89 chunks had already succeeded. repoProcessor.js would then
 *   mark the ENTIRE submission as repoStatus: 'failed', and a retry
 *   would re-embed everything from scratch, including the chunks that
 *   worked the first time.
 *
 *   This version changes the failure contract: each chunk now retries
 *   itself up to 2 extra times (3 attempts total) with a short backoff
 *   delay before giving up, and a chunk that still fails after all
 *   retries is marked failed WITHOUT crashing the other chunks' work.
 *   embedBatch() returns an array of per-chunk results — some
 *   successful (a vector), some failed (null) — instead of either
 *   "everything succeeded" or "everything's gone." The caller
 *   (repoProcessor.js) decides what to do with partial results.
 *
 * This file still follows the same shape as the provider functions in
 * utils/aiEvaluationService.js (evaluateWithOpenAI, evaluateWithClaude,
 * etc.) — a thin fetch() wrapper around an external AI API.
 *
 * .env keys required:
 *   GEMINI_API_KEY   (can reuse the one already used for AI evaluation
 *                      if you're using Gemini there too)
 *   EMBEDDING_MODEL  (defaults to 'gemini-embedding-001' below)
 */

const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || 'gemini-embedding-001';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Must match the column width declared in migrations/001_create_repo_chunks.sql
// (vector(768)). If you ever change this, a new migration is needed to
// alter the column — see the comment in that file.
const OUTPUT_DIMENSIONALITY = 768;

// gemini-embedding-001 takes one input per request (see comment above),
// so "batching" here means "how many requests to have in flight at once,"
// not "how many texts per request." Kept modest to avoid tripping the
// free tier's per-minute rate limit when processing a repo with many chunks.
const CONCURRENCY = 5;

// How many times to retry a single chunk's embedding call before giving
// up on it specifically. 3 total attempts (1 initial + 2 retries) is
// enough to ride out a momentary rate-limit hit or network blip without
// retrying so aggressively that it makes the rate-limit situation worse.
const MAX_ATTEMPTS_PER_CHUNK = 3;

// Delay before retrying a failed chunk, in milliseconds. Doubles each
// retry (200ms, then 400ms) — a small, standard "backoff" so a retry
// doesn't immediately re-hit a rate limit that hasn't reset yet.
const RETRY_BASE_DELAY_MS = 200;

function getModelPath() {
  return `models/${EMBEDDING_MODEL}`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Embeds a single piece of text. Used for the retrieval query (the
 * assignment description), which is just one string, not a batch.
 *
 * Note: this function itself does NOT retry — it's used directly during
 * retrieval (see retrievalService.js), where a single query embedding
 * failing should surface as a real error (retrieval just can't proceed
 * without it), not be silently retried. Retry logic lives in
 * embedChunkWithRetry() below, specifically for the bulk-indexing case
 * where partial tolerance makes sense.
 *
 * @param {string} text
 * @returns {Promise<number[]>} the embedding vector, length 768
 */
async function embedText(text) {
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not set in .env');
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/${getModelPath()}:embedContent?key=${GEMINI_API_KEY}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: getModelPath(),
      content: { parts: [{ text }] },
      outputDimensionality: OUTPUT_DIMENSIONALITY,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Gemini embedding error: ${response.status} ${body}`);
  }

  const data = await response.json();
  const values = data?.embedding?.values;
  if (!Array.isArray(values)) {
    throw new Error('Gemini embedding response missing embedding.values');
  }
  return values;
}

/**
 * Embeds one chunk of text, retrying on failure up to
 * MAX_ATTEMPTS_PER_CHUNK times with a short backoff between attempts.
 * Never throws — always resolves, either with a vector or with null.
 *
 * This is the key building block of the partial-tolerance fix: by
 * making a SINGLE chunk's failure resolve to `null` instead of
 * rejecting, the concurrent worker loop in runWithConcurrency below
 * never has anything to crash on — there's nothing left that throws.
 *
 * @param {string} text
 * @param {number} chunkIndex - only used for clearer log messages
 * @returns {Promise<number[]|null>}
 */
async function embedChunkWithRetry(text, chunkIndex) {
  let lastError = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS_PER_CHUNK; attempt++) {
    try {
      return await embedText(text);
    } catch (err) {
      lastError = err;
      const isLastAttempt = attempt === MAX_ATTEMPTS_PER_CHUNK;
      console.warn(
        `[embeddingService] chunk ${chunkIndex} embed attempt ${attempt}/${MAX_ATTEMPTS_PER_CHUNK} failed: ${err.message}` +
        (isLastAttempt ? ' — giving up on this chunk' : ' — retrying')
      );
      if (!isLastAttempt) {
        await sleep(RETRY_BASE_DELAY_MS * attempt); // 200ms, then 400ms
      }
    }
  }

  // All attempts exhausted — this chunk is lost, but nothing throws.
  // The caller (embedBatch) records this as `null` in its results array
  // and the rest of the batch keeps going, unaffected.
  console.error(`[embeddingService] chunk ${chunkIndex} permanently failed after ${MAX_ATTEMPTS_PER_CHUNK} attempts: ${lastError?.message}`);
  return null;
}

/**
 * Runs async tasks with a maximum number running at once, instead of
 * either running everything sequentially (slow) or all at once
 * (risks hitting rate limits / overwhelming the API).
 *
 * This is a small, dependency-free stand-in for what a library like
 * p-limit would normally provide — written out directly here because
 * it's about 15 lines and pulling in a package for it would be the
 * over-engineering this project is explicitly trying to avoid.
 *
 * 🔹 NOTE: this function's own logic is UNCHANGED from before — it was
 * never the source of the all-or-nothing problem. The fix lives one
 * layer up, in what kind of task functions get passed into it: tasks
 * that can no longer throw (see embedChunkWithRetry above) mean this
 * Promise.all() has nothing left to reject on.
 *
 * @param {Array<() => Promise<any>>} tasks - functions that return promises
 * @param {number} limit
 * @returns {Promise<any[]>} results in the same order as tasks
 */
async function runWithConcurrency(tasks, limit) {
  const results = new Array(tasks.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < tasks.length) {
      const currentIndex = nextIndex++;
      results[currentIndex] = await tasks[currentIndex]();
    }
  }

  const workers = Array.from({ length: Math.min(limit, tasks.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

/**
 * Embeds many texts. gemini-embedding-001 does not support true batch
 * requests (one input per call only — see file header), so this issues
 * one embedChunkWithRetry() call per input, with at most CONCURRENCY
 * requests in flight at a time.
 *
 * 🔹 CHANGED CONTRACT — previously this either resolved with a full
 * array of vectors or rejected entirely (all-or-nothing). Now it ALWAYS
 * resolves, with one entry per input text that is either a vector
 * (number[]) on success or `null` if that specific chunk permanently
 * failed after retries. The caller (repoProcessor.js) is responsible
 * for filtering out the nulls before inserting into Postgres — partial
 * results are now a normal, expected outcome, not an error condition.
 *
 * @param {string[]} texts
 * @returns {Promise<Array<number[]|null>>} one entry per input text,
 *   same order, never throws
 */
async function embedBatch(texts) {
  if (texts.length === 0) return [];

  const tasks = texts.map((text, idx) => () => embedChunkWithRetry(text, idx));
  return runWithConcurrency(tasks, CONCURRENCY);
}

module.exports = { embedText, embedBatch };