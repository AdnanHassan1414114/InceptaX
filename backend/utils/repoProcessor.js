/**
 * utils/repoProcessor.js
 *
 * 🔹 UPDATED FOR PGVECTOR — orchestrates the full repository-processing
 * pipeline for one submission:
 *
 *   clone -> walk file tree -> chunk files -> embed chunks -> save to Postgres
 *
 * WHAT CHANGED FROM THE MONGODB VERSION:
 *   Steps 1-4 (clone, walk, chunk, embed) are IDENTICAL — none of that
 *   logic knew or cared where vectors eventually get stored. Only step
 *   5 changed: instead of `RepoChunk.deleteMany()` + `RepoChunk.insertMany()`
 *   (Mongoose), it's now `deleteChunksForSubmission()` + `insertChunks()`
 *   (plain SQL functions from repoChunkRepository.js). The submission's
 *   repoStatus field still lives in MongoDB (on the Submission model) —
 *   only the chunk + embedding data moved to Postgres.
 *
 * This is still called fire-and-forget, right after a submission is
 * created — same pattern as before, no queue, no worker process.
 */

const Submission = require('../models/Submission');
const { cloneRepo, cleanupClone } = require('./repoCloneService');
const { collectFiles } = require('./repoFileWalker');
const { chunkFile } = require('./codeChunker');
const { embedBatch } = require('./embeddingService');
const { insertChunks, deleteChunksForSubmission } = require('./repoChunkRepository');

/**
 * Processes one submission's repository end to end.
 *
 * @param {string} submissionId
 * @param {string} repoLink - GitHub repository URL
 */
async function processRepository(submissionId, repoLink) {
  let clonedPath = null;

  try {
    await Submission.findByIdAndUpdate(submissionId, { repoStatus: 'processing' });

    // 1. Clone — single network operation, gets the whole file tree.
    // Unchanged from the MongoDB version.
    clonedPath = await cloneRepo(repoLink, submissionId);

    // 2. Walk — filter down to files worth analyzing.
    // Unchanged from the MongoDB version.
    const files = await collectFiles(clonedPath);

    if (files.length === 0) {
      console.warn(`[repoProcessor] No analyzable files found for submission ${submissionId}`);
      await Submission.findByIdAndUpdate(submissionId, { repoStatus: 'ready' });
      return;
    }

    // 3. Chunk — split each file at function/class boundaries.
    // Unchanged from the MongoDB version.
    const allChunks = [];
    for (const file of files) {
      const fileChunks = chunkFile(file.filePath, file.content);
      for (const chunk of fileChunks) {
        allChunks.push({ filePath: file.filePath, ...chunk });
      }
    }

    if (allChunks.length === 0) {
      console.warn(`[repoProcessor] No chunks produced for submission ${submissionId}`);
      await Submission.findByIdAndUpdate(submissionId, { repoStatus: 'ready' });
      return;
    }

    // 4. Embed — convert every chunk's text into a vector, in batches.
    // 🔹 UPDATED — embedBatch() now tolerates partial failure (see
    // embeddingService.js header comment). It always resolves, with
    // `null` in place of any chunk that permanently failed after
    // retries, instead of rejecting the whole call the moment any
    // single chunk failed. This step itself doesn't need to change —
    // it still just calls embedBatch() and gets an array back — but the
    // save step right below DOES need to handle the new possibility of
    // null entries mixed in with real vectors.
    const texts = allChunks.map((c) => c.chunkText);
    const vectors = await embedBatch(texts);

    // 5. Save — 🔹 CHANGED: now writes to Postgres instead of MongoDB,
    // AND now filters out any chunk whose embedding permanently failed
    // (vectors[idx] === null) before inserting. Previously, a single
    // failed chunk anywhere in the batch would have thrown out of
    // embedBatch() entirely, never reaching this line at all — every
    // chunk would be lost, not just the one that failed. Now, only the
    // genuinely-failed chunks are excluded; everything that DID embed
    // successfully still gets saved and is usable by retrieval.
    const submissionIdStr = submissionId.toString();
    await deleteChunksForSubmission(submissionIdStr);

    const chunksWithEmbeddings = allChunks
      .map((chunk, idx) => ({
        filePath: chunk.filePath,
        chunkText: chunk.chunkText,
        startLine: chunk.startLine,
        endLine: chunk.endLine,
        embedding: vectors[idx],
      }))
      .filter((chunk) => chunk.embedding !== null);

    const failedCount = allChunks.length - chunksWithEmbeddings.length;

    // 🔹 NEW — only mark the WHOLE submission as 'failed' if literally
    // nothing could be embedded (e.g. GEMINI_API_KEY is missing/invalid,
    // or Gemini is down entirely — a systemic problem, not a few
    // unlucky chunks). If at least one chunk succeeded, the submission
    // proceeds to 'ready' with whatever was salvaged — retrieval will
    // simply have a slightly smaller pool of chunks to search, which is
    // a much better outcome than no chunks and no evaluation context at
    // all. The failedCount is logged so this is visible/debuggable
    // without being treated as a hard failure.
    if (chunksWithEmbeddings.length === 0) {
      throw new Error(
        `All ${allChunks.length} chunks failed to embed — this looks like a systemic issue ` +
        `(check GEMINI_API_KEY, Gemini API status, or rate limits), not a few unlucky chunks.`
      );
    }

    if (failedCount > 0) {
      console.warn(
        `[repoProcessor] Submission ${submissionId}: ${failedCount} of ${allChunks.length} chunks ` +
        `permanently failed to embed and were skipped. Proceeding with the ${chunksWithEmbeddings.length} that succeeded.`
      );
    }

    await insertChunks(submissionIdStr, chunksWithEmbeddings);

    await Submission.findByIdAndUpdate(submissionId, { repoStatus: 'ready' });
    console.log(`[repoProcessor] Submission ${submissionId}: stored ${chunksWithEmbeddings.length} chunks in Postgres`);
  } catch (err) {
    console.error(`[repoProcessor] Failed for submission ${submissionId}:`, err.message);
    await Submission.findByIdAndUpdate(submissionId, { repoStatus: 'failed' }).catch(() => {});
  } finally {
    // Always clean up the temp clone, even if an earlier step threw.
    // Unchanged from the MongoDB version.
    await cleanupClone(clonedPath);
  }
}

module.exports = { processRepository };