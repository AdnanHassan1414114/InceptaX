/**
 * utils/repoCloneService.js
 *
 * Gets a submitted GitHub repository onto local disk so its files can be
 * read directly, instead of going through the GitHub Contents API.
 *
 * WHY SHALLOW CLONE INSTEAD OF THE GITHUB API:
 *   The GitHub Contents API requires one HTTP call per directory listing
 *   PLUS one HTTP call per file to get its content (responses are paginated
 *   and base64-encoded). For a repo with 100+ files, that's 100+ round trips
 *   and burns through GitHub's rate limit (5,000 req/hr authenticated) fast
 *   across many submissions.
 *
 *   `git clone --depth 1` is a SINGLE network operation that gets the entire
 *   file tree (only the latest commit — no history, which we don't need for
 *   evaluation). After that, every file read is a local filesystem read —
 *   instant, free, no rate limit.
 *
 * This file is intentionally the ONLY place that knows how to get repo
 * content onto disk. If this project ever needs to switch to the GitHub
 * API (e.g. for private repos without clone access, or sandboxing concerns),
 * only this file changes — repoProcessor.js just calls cloneRepo() and
 * doesn't care how it was implemented.
 */

const { exec } = require('child_process');
const fs = require('fs/promises');
const path = require('path');

const TMP_ROOT = process.env.REPO_CLONE_TMP_DIR || '/tmp/inceptax-repos';

/**
 * Runs a shell command and resolves/rejects based on exit code.
 * Wrapped manually instead of using execSync so cloning doesn't block
 * the Node event loop while it runs.
 */
function run(command, options = {}) {
  return new Promise((resolve, reject) => {
    exec(command, { timeout: 60_000, ...options }, (err, stdout, stderr) => {
      if (err) {
        reject(new Error(`Command failed: ${command}\n${stderr || err.message}`));
      } else {
        resolve(stdout);
      }
    });
  });
}

/**
 * Converts a GitHub repo URL into a clean clone target.
 * Strips trailing slashes and ".git" so the URL is consistent regardless
 * of how the user pasted it (this mirrors the GITHUB_REPO_REGEX already
 * used in validators/submissionValidators.js).
 */
function normalizeRepoUrl(repoLink) {
  return repoLink.trim().replace(/\/+$/, '').replace(/\.git$/, '');
}

/**
 * Shallow-clones a GitHub repository to a unique temp directory.
 *
 * @param {string} repoLink - GitHub repository URL (already validated
 *   upstream by submissionValidators.createSubmission's GITHUB_REPO_REGEX)
 * @param {string} submissionId - used to build a unique, traceable temp path
 * @returns {Promise<string>} absolute path to the cloned directory
 */
async function cloneRepo(repoLink, submissionId) {
  const cleanUrl = normalizeRepoUrl(repoLink);
  const targetDir = path.join(TMP_ROOT, `repo-${submissionId}`);

  // Ensure the parent tmp directory exists
  await fs.mkdir(TMP_ROOT, { recursive: true });

  // Remove any leftover directory from a previous failed attempt
  await fs.rm(targetDir, { recursive: true, force: true });

  // --depth 1: only the latest commit, no history — faster, smaller, and
  // history isn't useful for evaluating "is this submission good."
  // --single-branch: don't fetch other branches.
  await run(`git clone --depth 1 --single-branch "${cleanUrl}.git" "${targetDir}"`);

  return targetDir;
}

/**
 * Deletes the cloned directory. Always call this in a `finally` block
 * after processing, even if earlier steps threw, so /tmp doesn't fill up.
 *
 * @param {string} dirPath - the path returned by cloneRepo()
 */
async function cleanupClone(dirPath) {
  if (!dirPath) return;
  try {
    await fs.rm(dirPath, { recursive: true, force: true });
  } catch (err) {
    // Non-fatal — worst case a stale temp folder remains and can be
    // cleaned up by an OS-level /tmp janitor or a future cron job.
    console.error('[repoCloneService] cleanup error:', err.message);
  }
}

module.exports = { cloneRepo, cleanupClone };