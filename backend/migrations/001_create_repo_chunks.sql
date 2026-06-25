-- migrations/001_create_repo_chunks.sql
--
-- One-time setup script. Run this once against your Postgres database
-- before deploying the RAG pipeline.
--
-- HOW TO RUN:
--   psql "$POSTGRES_URL" -f migrations/001_create_repo_chunks.sql
--
-- WHAT THIS DOES, IN ORDER:
--   1. Enables the pgvector extension — this adds a new column type
--      (`vector`) and new operators (like `<=>` for cosine distance) to
--      Postgres. Without this line, Postgres has no idea what a "vector"
--      column even is.
--   2. Creates the repo_chunks table — one row per code chunk, same
--      shape as the old MongoDB RepoChunk documents, just as SQL columns
--      instead of a JSON-like document.
--   3. Creates an index on submission_id — every retrieval query filters
--      by one submission first (WHERE submission_id = ...), so this
--      keeps that filter fast regardless of how many chunks accumulate
--      across all submissions over time.
--   4. Creates an HNSW index on the embedding column — this is what
--      makes nearest-neighbor search fast. Without it, pgvector still
--      works, but falls back to scanning every row (the same brute-force
--      approach the MongoDB version used) — see the comment above the
--      index for more on what HNSW actually does.

-- 1. Enable the extension. Safe to run multiple times — IF NOT EXISTS
-- means this is a no-op if already enabled.
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. The table.
--
-- embedding vector(768):
--   "vector" is the new column type from the extension above.
--   768 is the FIXED dimension every row's vector must have — Postgres
--   enforces that automatically once the column has a declared dimension.
--
--   The embedding model in use (gemini-embedding-001, see
--   utils/embeddingService.js) defaults to 3072 dimensions, NOT 768.
--   768 is achieved by explicitly passing output_dimensionality: 768 in
--   every embedding API call — Google's own benchmarks show this is
--   only a ~0.26% quality loss versus the full 3072 output, at a
--   quarter of the storage cost, so it's a deliberate choice, not a
--   limitation worked around.
--
--   If you ever change EMBEDDING_MODEL or the requested
--   output_dimensionality, this column's declared width must change to
--   match (a new migration) — mixing vector lengths in one column isn't
--   meaningful for similarity search, and pgvector will reject any
--   insert whose vector length doesn't match the column exactly.
CREATE TABLE IF NOT EXISTS repo_chunks (
    id            BIGSERIAL PRIMARY KEY,
    submission_id VARCHAR(24)  NOT NULL,  -- Mongo ObjectId as a string, since Submission still lives in MongoDB
    file_path     TEXT         NOT NULL,
    chunk_text    TEXT         NOT NULL,
    start_line    INTEGER      NOT NULL DEFAULT 0,
    end_line      INTEGER      NOT NULL DEFAULT 0,
    embedding     vector(768)  NOT NULL,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- 3. Ordinary B-tree index — every retrieval query filters by
-- submission_id first, so this index keeps that lookup fast no matter
-- how many total chunks exist across all submissions.
CREATE INDEX IF NOT EXISTS idx_repo_chunks_submission_id
    ON repo_chunks (submission_id);

-- 4. HNSW (Hierarchical Navigable Small World) index on the embedding
-- column. This is the actual "vector search index" — the thing that
-- makes pgvector a real vector database rather than just "a table with
-- a vector-shaped column."
--
-- WHAT HNSW DOES, IN PLAIN TERMS:
--   Without an index, finding the nearest vectors to a query means
--   comparing the query against EVERY row (exactly what the MongoDB
--   brute-force version did in Node). HNSW pre-builds a navigable graph
--   structure over all stored vectors at insert time, so a search can
--   skip most of the data and jump straight toward the closest matches —
--   similar in spirit to how a B-tree index lets a database skip most
--   rows during a WHERE id = ? lookup instead of scanning the whole
--   table. You don't need to understand the graph internals to use it
--   or explain it — the one-sentence version ("it's a pre-built index
--   structure that makes nearest-neighbor search fast instead of
--   scanning every row") is enough for any interview context.
--
-- vector_cosine_ops: tells the index to optimize for COSINE distance
-- specifically — this must match the operator used in retrieval queries
-- (the <=> operator below uses cosine distance). pgvector also supports
-- L2 distance (<->) and inner product (<#>) ops; cosine is the right
-- choice here because it's the same metric the MongoDB version used
-- (cosineSimilarity()), so query behavior is unchanged, only where the
-- math runs has changed.
CREATE INDEX IF NOT EXISTS idx_repo_chunks_embedding_hnsw
    ON repo_chunks
    USING hnsw (embedding vector_cosine_ops);

-- That's the entire migration. No rows are inserted here — chunk data
-- is written by utils/repoProcessor.js at runtime via repoChunkRepository.js.