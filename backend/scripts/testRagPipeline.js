/**
 * scripts/testRagPipeline.js
 *
 * Run this ONCE, manually, before trusting the RAG pipeline with real
 * user submissions. It walks through the exact same 5 steps a real
 * submission triggers (clone -> chunk -> embed -> save -> retrieve),
 * but against one test repo you choose, printing what's happening at
 * every step so a broken setup (wrong API key, unreachable Postgres,
 * missing git binary, etc.) shows up immediately and clearly — instead
 * of failing silently inside the fire-and-forget call a real submission
 * uses, where you'd only ever see it by reading server logs.
 *
 * HOW TO RUN:
 *   node scripts/testRagPipeline.js
 *
 * You can optionally pass a different repo URL and assignment description
 * as arguments:
 *   node scripts/testRagPipeline.js https://github.com/expressjs/express "Build a REST API"
 *
 * If no arguments are given, it defaults to a small, well-known public
 * repo and a generic assignment description, just to prove the pipeline
 * works end to end.
 *
 * WHAT THIS SCRIPT DOES NOT DO:
 *   It does not touch your real Submission/Assignment data in MongoDB.
 *   It uses a fake, clearly-marked test submissionId (not a real
 *   ObjectId tied to a real user) so nothing in your actual database is
 *   read, written, or affected. The only real side effects are:
 *     - rows inserted into the Postgres repo_chunks table (cleaned up
 *       automatically at the end of this script)
 *     - real API calls to Gemini (counts against your daily free-tier quota)
 *     - a temporary git clone in /tmp (cleaned up automatically)
 */

require('dotenv').config();

const { cloneRepo, cleanupClone } = require('../utils/repoCloneService');
const { collectFiles } = require('../utils/repoFileWalker');
const { chunkFile } = require('../utils/codeChunker');
const { embedBatch, embedText } = require('../utils/embeddingService');
const {
  insertChunks,
  deleteChunksForSubmission,
  findSimilarChunks,
} = require('../utils/repoChunkRepository');

// A fixed, obviously-fake ID — never collides with a real Mongo ObjectId
// pattern in normal use, and is deleted from Postgres at the end of this
// script regardless of whether it succeeds or fails.
const TEST_SUBMISSION_ID = 'test-pipeline-run-000001';

const DEFAULT_REPO_URL = process.argv[2] || 'https://github.com/expressjs/express';
const DEFAULT_ASSIGNMENT_DESCRIPTION =
  process.argv[3] || 'Build a REST API with authentication and middleware';

// ── Small helpers for readable terminal output ────────────────────────────

function step(n, total, label) {
  console.log(`\n[${n}/${total}] ${label}`);
}

function ok(message) {
  console.log(`   ✅ ${message}`);
}

function fail(message, err) {
  console.error(`   ❌ FAILED: ${message}`);
  console.error(`      ${err.message}`);
}

// ── Main ───────────────────────────────────────────────────────────────────

async function run() {
  console.log('════════════════════════════════════════════════════════');
  console.log(' RAG PIPELINE TEST RUN');
  console.log(`   Repo:        ${DEFAULT_REPO_URL}`);
  console.log(`   Description: "${DEFAULT_ASSIGNMENT_DESCRIPTION}"`);
  console.log('════════════════════════════════════════════════════════');

  const TOTAL_STEPS = 5;
  let clonedPath = null;

  try {
    // ── Step 1: Clone ─────────────────────────────────────────────────────
    step(1, TOTAL_STEPS, 'Cloning repository...');
    clonedPath = await cloneRepo(DEFAULT_REPO_URL, TEST_SUBMISSION_ID);
    ok(`Cloned to ${clonedPath}`);

    // ── Step 2: Walk + Chunk ─────────────────────────────────────────────
    step(2, TOTAL_STEPS, 'Walking file tree and chunking files...');
    const files = await collectFiles(clonedPath);
    if (files.length === 0) {
      throw new Error('No analyzable files found — is this repo empty or all binary/excluded files?');
    }
    ok(`Found ${files.length} analyzable files`);

    const allChunks = [];
    for (const file of files) {
      const fileChunks = chunkFile(file.filePath, file.content);
      for (const chunk of fileChunks) {
        allChunks.push({ filePath: file.filePath, ...chunk });
      }
    }
    if (allChunks.length === 0) {
      throw new Error('Chunking produced zero chunks from non-empty files — check codeChunker.js logic');
    }
    ok(`Produced ${allChunks.length} chunks`);
    console.log(`      Example chunk: ${allChunks[0].filePath} (lines ${allChunks[0].startLine}-${allChunks[0].endLine})`);

    // ── Step 3: Embed ─────────────────────────────────────────────────────
    step(3, TOTAL_STEPS, `Embedding ${allChunks.length} chunks via Gemini (this calls the real API)...`);
    const texts = allChunks.map((c) => c.chunkText);
    const vectors = await embedBatch(texts);
    if (vectors.length !== allChunks.length) {
      throw new Error(`Expected ${allChunks.length} vectors back, got ${vectors.length}`);
    }
    ok(`Received ${vectors.length} embedding vectors (length ${vectors[0]?.length || 0} each)`);

    // ── Step 4: Save to Postgres ──────────────────────────────────────────
    step(4, TOTAL_STEPS, 'Saving chunks + embeddings to Postgres...');
    await deleteChunksForSubmission(TEST_SUBMISSION_ID); // clean slate, in case of a previous test run
    const docs = allChunks.map((chunk, idx) => ({
      filePath: chunk.filePath,
      chunkText: chunk.chunkText,
      startLine: chunk.startLine,
      endLine: chunk.endLine,
      embedding: vectors[idx],
    }));
    await insertChunks(TEST_SUBMISSION_ID, docs);
    ok(`Inserted ${docs.length} rows into repo_chunks`);

    // ── Step 5: Retrieve ──────────────────────────────────────────────────
    step(5, TOTAL_STEPS, 'Testing retrieval with the sample assignment description...');
    const queryVector = await embedText(DEFAULT_ASSIGNMENT_DESCRIPTION);
    const topMatches = await findSimilarChunks(TEST_SUBMISSION_ID, queryVector, 5);

    if (topMatches.length === 0) {
      throw new Error('Retrieval returned zero matches — check the HNSW index exists and rows were actually inserted');
    }

    ok(`Retrieved top ${topMatches.length} matches:`);
    topMatches.forEach((m, i) => {
      console.log(
        `      ${i + 1}. ${m.filePath} (lines ${m.startLine}-${m.endLine}) — score: ${m.score.toFixed(3)}`
      );
    });

    console.log('\n════════════════════════════════════════════════════════');
    console.log(' ✅ PIPELINE WORKING END TO END');
    console.log('════════════════════════════════════════════════════════');
  } catch (err) {
    console.log('\n════════════════════════════════════════════════════════');
    fail('Pipeline test did not complete', err);
    console.log('════════════════════════════════════════════════════════');
    console.log('\nWhere to look based on which step failed:');
    console.log('  Step 1 (clone)    -> check git is installed, repo URL is public/correct, REPO_CLONE_TMP_DIR is writable');
    console.log('  Step 2 (chunk)    -> check codeChunker.js / repoFileWalker.js logic, or the repo genuinely has no matching files');
    console.log('  Step 3 (embed)    -> check GEMINI_API_KEY in .env, check you have not exceeded the daily free-tier quota');
    console.log('  Step 4 (save)     -> check POSTGRES_URL in .env, check the migration (001_create_repo_chunks.sql) has been run');
    console.log('  Step 5 (retrieve) -> check the HNSW index was created by the migration, check repo_chunks has rows for this submission_id');
    process.exitCode = 1;
  } finally {
    // Always clean up — both the temp clone on disk and the test rows in
    // Postgres — regardless of success or failure, so re-running this
    // script never accumulates leftover data.
    await cleanupClone(clonedPath);
    await deleteChunksForSubmission(TEST_SUBMISSION_ID).catch(() => {});
    console.log('\n(Cleaned up temp clone and test rows in Postgres)');
    process.exit(process.exitCode || 0);
  }
}

run();