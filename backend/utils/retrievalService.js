/**
 * utils/retrievalService.js
 *
 * 🔹 UPDATED FOR PGVECTOR — finds the most relevant code chunks for a
 * submission, given a query (the assignment description).
 *
 * WHAT CHANGED FROM THE MONGODB VERSION:
 *   Previously, this file fetched every chunk for a submission out of
 *   MongoDB and computed cosine similarity against each one in a JS
 *   loop (a hand-written cosineSimilarity() function). Now, the actual
 *   similarity search runs INSIDE Postgres via repoChunkRepository's
 *   findSimilarChunks() — one SQL query using pgvector's <=> operator,
 *   backed by the HNSW index created in the migration.
 *
 *   This file's own job has gotten SMALLER, not more complex: it now
 *   only (1) builds the query text, (2) embeds it, and (3) hands the
 *   resulting vector to the repository layer. The math moved out of
 *   this file entirely — there is no cosineSimilarity() function here
 *   anymore, because Postgres does that part now.
 *
 * THIS IS STILL "the one file that changes if the storage layer
 * changes" — true to the original design promise. Today it talks to
 * Postgres; if you ever moved to a managed vector DB like Pinecone
 * instead, only the repoChunkRepository import and the final call below
 * would need to change.
 */

const { findSimilarChunks, hasChunks } = require('./repoChunkRepository');
const { embedText } = require('./embeddingService');

const DEFAULT_TOP_K = parseInt(process.env.RETRIEVAL_TOP_K || '8', 10);

/**
 * Builds the text used as the retrieval query. The assignment
 * description effectively acts as the rubric — embedding it and
 * searching for the closest code chunks surfaces the parts of the repo
 * most relevant to what the assignment actually asked for.
 *
 * Unchanged from the MongoDB version — this logic has nothing to do
 * with where vectors are stored.
 *
 * @param {object} assignment - populated Assignment document
 */
function buildQueryText(assignment) {
  return [
    assignment?.title,
    assignment?.difficulty ? `Difficulty: ${assignment.difficulty}` : null,
    assignment?.description,
  ]
    .filter(Boolean)
    .join('\n');
}

/**
 * Retrieves the top-K most relevant chunks for a submission.
 *
 * @param {string} submissionId
 * @param {object} assignment - populated Assignment document (title,
 *   description, difficulty) — used to build the query text
 * @param {number} [topK]
 * @returns {Promise<Array<{ filePath, chunkText, startLine, endLine, score }>>}
 *   Empty array if no chunks exist yet (e.g. repo processing hasn't
 *   finished, or failed) — callers should treat this as "no repo
 *   context available" and fall back to description-only evaluation,
 *   not as an error. Same contract as the MongoDB version, unchanged.
 */
async function retrieveRelevantChunks(submissionId, assignment, topK = DEFAULT_TOP_K) {
  const submissionIdStr = submissionId.toString();

  // Cheap existence check before paying for an embedding API call —
  // no point embedding the query if there's nothing to search against
  // yet (repo still processing, or processing failed).
  const exists = await hasChunks(submissionIdStr);
  if (!exists) return [];

  const queryText = buildQueryText(assignment);
  if (!queryText) return [];

  const queryVector = await embedText(queryText);

  // The actual nearest-neighbor search now happens inside Postgres,
  // using the HNSW index — see repoChunkRepository.findSimilarChunks
  // for the SQL and what <=> means.
  return findSimilarChunks(submissionIdStr, queryVector, topK);
}

module.exports = { retrieveRelevantChunks, buildQueryText };