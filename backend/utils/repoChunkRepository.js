/**
 * utils/repoChunkRepository.js
 *
 * Plain SQL data-access functions for the repo_chunks table. This is the
 * direct replacement for the old models/RepoChunk.js Mongoose model —
 * same role (read/write chunk + embedding data), different mechanics
 * (raw SQL instead of a Mongoose schema).
 *
 * Every function here wraps exactly ONE SQL statement and does nothing
 * else — no business logic, no orchestration. That's deliberate: this
 * file's only job is "talk to the repo_chunks table," the same way
 * config/redisClient.js's only job is "talk to Redis." Orchestration
 * (deciding WHEN to call these) lives in utils/repoProcessor.js and
 * utils/retrievalService.js.
 */

const getPgPool = require('../config/pgClient');

/**
 * Bulk-inserts chunks for a submission. Called once, after embeddings
 * have been generated for every chunk from a freshly cloned repo.
 *
 * Uses a single multi-row INSERT instead of one INSERT per chunk —
 * much faster for the 50-150 rows a typical repo produces, and it's
 * the direct SQL equivalent of Mongoose's insertMany() from the old
 * version.
 *
 * @param {string} submissionId - Mongo ObjectId as a string
 * @param {Array<{ filePath, chunkText, startLine, endLine, embedding }>} chunks
 */
async function insertChunks(submissionId, chunks) {
  if (chunks.length === 0) return;

  const pool = getPgPool();

  // Build a parameterized multi-row INSERT:
  //   INSERT INTO repo_chunks (...) VALUES ($1,$2,$3,$4,$5,$6), ($7,$8,...)
  // Parameterized (using $1, $2, ... placeholders) rather than string-
  // concatenating values directly — this is what prevents SQL injection,
  // the same reason Mongoose query objects are safe by default.
  const columns = ['submission_id', 'file_path', 'chunk_text', 'start_line', 'end_line', 'embedding'];
  const valuesSql = [];
  const params = [];

  chunks.forEach((chunk, idx) => {
    const base = idx * columns.length;
    valuesSql.push(
      `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6})`
    );
    params.push(
      submissionId,
      chunk.filePath,
      chunk.chunkText,
      chunk.startLine,
      chunk.endLine,
      // pgvector accepts a vector literal as a string like '[0.1,0.2,...]'
      // — the 'pg' driver doesn't know about the vector type natively,
      // so we format the array ourselves. This is the one place this
      // file deals with pgvector's specific format requirement.
      `[${chunk.embedding.join(',')}]`
    );
  });

  const sql = `
    INSERT INTO repo_chunks (${columns.join(', ')})
    VALUES ${valuesSql.join(', ')}
  `;

  await pool.query(sql, params);
}

/**
 * Deletes all chunks for a submission. Called before re-inserting, so
 * a resubmission flow doesn't leave stale chunks from a previous
 * attempt sitting alongside new ones.
 *
 * @param {string} submissionId
 */
async function deleteChunksForSubmission(submissionId) {
  const pool = getPgPool();
  await pool.query('DELETE FROM repo_chunks WHERE submission_id = $1', [submissionId]);
}

/**
 * Checks whether any chunks exist yet for a submission. Used by
 * retrievalService to short-circuit (return []) instead of running a
 * vector search against zero rows.
 *
 * @param {string} submissionId
 * @returns {Promise<boolean>}
 */
async function hasChunks(submissionId) {
  const pool = getPgPool();
  const result = await pool.query(
    'SELECT 1 FROM repo_chunks WHERE submission_id = $1 LIMIT 1',
    [submissionId]
  );
  return result.rows.length > 0;
}

/**
 * THE retrieval query — finds the top-K chunks for a submission whose
 * embedding is closest to the given query vector.
 *
 * <=> is pgvector's cosine DISTANCE operator (not similarity — distance
 * is the inverse: 0 = identical, 2 = completely opposite). That's why
 * ORDER BY embedding <=> $queryVector ASC gives the closest matches
 * first — we want the smallest distance, not the largest.
 *
 * This single SQL query replaces the old MongoDB version's three steps
 * (fetch all chunks for the submission -> loop in JS computing cosine
 * similarity for each -> sort -> slice). Here, the WHERE clause filters
 * to one submission, the index-backed ORDER BY does the similarity
 * ranking, and LIMIT takes only the top K — all inside Postgres, in one
 * round trip, using the HNSW index created in the migration so it
 * doesn't have to scan every row to do it.
 *
 * @param {string} submissionId
 * @param {number[]} queryVector
 * @param {number} topK
 * @returns {Promise<Array<{ filePath, chunkText, startLine, endLine, score }>>}
 */
async function findSimilarChunks(submissionId, queryVector, topK) {
  const pool = getPgPool();
  const vectorLiteral = `[${queryVector.join(',')}]`;

  const result = await pool.query(
    `
      SELECT
        file_path,
        chunk_text,
        start_line,
        end_line,
        1 - (embedding <=> $2) AS score
      FROM repo_chunks
      WHERE submission_id = $1
      ORDER BY embedding <=> $2 ASC
      LIMIT $3
    `,
    [submissionId, vectorLiteral, topK]
  );

  // 1 - cosine_distance = cosine_similarity, converting back to the
  // same -1..1 "higher is more similar" scale the MongoDB version used,
  // so callers (aiEvaluationService.js) don't need to know this changed.
  return result.rows.map((row) => ({
    filePath: row.file_path,
    chunkText: row.chunk_text,
    startLine: row.start_line,
    endLine: row.end_line,
    score: row.score,
  }));
}

module.exports = {
  insertChunks,
  deleteChunksForSubmission,
  hasChunks,
  findSimilarChunks,
};