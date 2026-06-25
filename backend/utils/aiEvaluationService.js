/**
 * utils/aiEvaluationService.js
 *
 * Calls 5 AI providers in parallel to evaluate a submission.
 * Each provider receives the same prompt and returns:
 *   - score (0-100)
 *   - strengths
 *   - weaknesses
 *   - improvements
 *   - issues
 *
 * If any provider fails, it is skipped gracefully — the others still run.
 * finalScore = average of all successful provider scores.
 *
 * 🔹 UPDATED — buildPrompt() now accepts retrieved repository chunks
 * (relevantChunks) and injects them into the prompt as actual code
 * context, instead of relying solely on the repo URL string and the
 * developer's self-written description. This is the "Augmented" half
 * of RAG — retrieval (see utils/retrievalService.js) happens just
 * before this function is called; this function's only new job is to
 * format those chunks into readable prompt text.
 *
 * If no chunks are available (repo still processing, processing failed,
 * or this is an old submission from before this feature existed),
 * relevantChunks is an empty array and the prompt gracefully falls back
 * to exactly the description-only behavior this function had before —
 * nothing breaks for submissions without repo context.
 *
 * .env keys required:
 *   OPENAI_API_KEY
 *   ANTHROPIC_API_KEY
 *   DEEPSEEK_API_KEY
 *   GEMINI_API_KEY
 *   GROQ_API_KEY
 */

const { retrieveRelevantChunks } = require('./retrievalService'); // 🔹 NEW

// ── Repository context formatter ──────────────────────────────────────────
// Turns retrieved chunks into a readable block for the prompt. Kept as
// its own small function (rather than inlined into buildPrompt) so it's
// easy to test and easy to point to in an interview as "this is the
// exact place retrieved context gets turned into prompt text."
function formatRepoContext(relevantChunks) {
  if (!relevantChunks || relevantChunks.length === 0) {
    return 'No repository content was available for this evaluation — base your assessment on the description and links provided below.';
  }

  return relevantChunks
    .map(
      (chunk, idx) =>
        `[Snippet ${idx + 1}] ${chunk.filePath} (lines ${chunk.startLine}-${chunk.endLine}):\n` +
        '```\n' + chunk.chunkText + '\n```'
    )
    .join('\n\n');
}

// ── Prompt builder ────────────────────────────────────────────────────────────
// 🔹 UPDATED — accepts relevantChunks (array, may be empty) as a second
// parameter. Everything else about this function's shape is unchanged.
function buildPrompt(submission, relevantChunks = []) {
  return `You are a senior software engineer evaluating a developer's project submission for a coding challenge.

Challenge: "${submission.assignmentId?.title || 'Unknown'}"
Difficulty: ${submission.assignmentId?.difficulty || 'medium'}
Description: ${submission.assignmentId?.description || 'N/A'}

Submission Details:
- GitHub Repository: ${submission.repoLink}
- Live Demo: ${submission.liveLink || 'Not provided'}
- Developer's Description: ${submission.description || 'Not provided'}

Relevant Repository Content (retrieved as the most relevant snippets to this challenge):
${formatRepoContext(relevantChunks)}

Please evaluate this submission and respond ONLY with a valid JSON object in this exact format (no markdown, no explanation, just the JSON):
{
  "score": <integer 0-100>,
  "strengths": [<string>, <string>, <string>],
  "weaknesses": [<string>, <string>],
  "improvements": [<string>, <string>, <string>],
  "issues": [<string>, <string>]
}

Scoring guide:
- 90-100: Exceptional, production-ready
- 75-89: Strong, minor improvements needed
- 60-74: Good, several areas to improve
- 40-59: Average, significant work needed
- 0-39: Below expectations

Base your evaluation primarily on the actual repository content shown above. Use the description and links as supporting context. Be specific and constructive.`;
}

// ── Response parser ───────────────────────────────────────────────────────────
function parseAIResponse(text) {
  try {
    const clean = text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);
    return {
      score:        Math.min(100, Math.max(0, parseInt(parsed.score) || 0)),
      strengths:    Array.isArray(parsed.strengths)    ? parsed.strengths    : [],
      weaknesses:   Array.isArray(parsed.weaknesses)   ? parsed.weaknesses   : [],
      improvements: Array.isArray(parsed.improvements) ? parsed.improvements : [],
      issues:       Array.isArray(parsed.issues)       ? parsed.issues       : [],
    };
  } catch {
    return null;
  }
}

// ── Provider: OpenAI ──────────────────────────────────────────────────────────
async function evaluateWithOpenAI(prompt) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model:       'gpt-4o-mini', // cheap + fast
      messages:    [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens:  500,
    }),
  });

  if (!response.ok) throw new Error(`OpenAI error: ${response.status}`);
  const data = await response.json();
  return parseAIResponse(data.choices[0]?.message?.content || '');
}

// ── Provider: Claude (Anthropic) ──────────────────────────────────────────────
async function evaluateWithClaude(prompt) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method:  'POST',
    headers: {
      'Content-Type':      'application/json',
      'x-api-key':         process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model:      'claude-3-5-haiku-20241022', // FIX: was 'claude-haiku-4-5' — invalid model string, caused 404 from Anthropic API
      max_tokens: 500,
      messages:   [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) throw new Error(`Claude error: ${response.status}`);
  const data = await response.json();
  return parseAIResponse(data.content[0]?.text || '');
}

// ── Provider: DeepSeek ────────────────────────────────────────────────────────
async function evaluateWithDeepSeek(prompt) {
  const response = await fetch('https://api.deepseek.com/chat/completions', {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`,
    },
    body: JSON.stringify({
      model:       'deepseek-chat',
      messages:    [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens:  500,
    }),
  });

  if (!response.ok) throw new Error(`DeepSeek error: ${response.status}`);
  const data = await response.json();
  return parseAIResponse(data.choices[0]?.message?.content || '');
}

// ── Provider: Gemini ──────────────────────────────────────────────────────────
async function evaluateWithGemini(prompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;

  const response = await fetch(url, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.3, maxOutputTokens: 500 },
    }),
  });

  if (!response.ok) throw new Error(`Gemini error: ${response.status}`);
  const data = await response.json();
  return parseAIResponse(data.candidates[0]?.content?.parts[0]?.text || '');
}

// ── Provider: Groq (Llama) ────────────────────────────────────────────────────
async function evaluateWithGroq(prompt) {
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model:       'llama3-8b-8192', // fast + free tier
      messages:    [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens:  500,
    }),
  });

  if (!response.ok) throw new Error(`Groq error: ${response.status}`);
  const data = await response.json();
  return parseAIResponse(data.choices[0]?.message?.content || '');
}

// ── Main evaluator ────────────────────────────────────────────────────────────
/**
 * Runs all 5 AI providers in parallel.
 * Failed providers are skipped gracefully.
 * Returns array of successful evaluations + average finalScore.
 *
 * @param {object} submission - populated Submission document
 * @returns {{ evaluations: Array, finalScore: number }}
 */
async function evaluateSubmissionWithAI(submission) {
  // 🔹 NEW — retrieve the most relevant repository chunks before
  // building the prompt. This is the only new step in this function;
  // everything below it (the 5-provider Promise.allSettled call) is
  // completely unchanged.
  //
  // retrieveRelevantChunks never throws on "no chunks found" — it
  // returns [] in that case (e.g. repo still processing, or processing
  // failed) — so this is safe to call unconditionally.
  const relevantChunks = await retrieveRelevantChunks(
    submission._id,
    submission.assignmentId
  ).catch((err) => {
    console.error('[aiEvaluationService] retrieval error (falling back to no context):', err.message);
    return [];
  });

  const prompt = buildPrompt(submission, relevantChunks);

  const providers = [
    { name: 'openai',   fn: evaluateWithOpenAI   },
    { name: 'claude',   fn: evaluateWithClaude   },
    { name: 'deepseek', fn: evaluateWithDeepSeek },
    { name: 'gemini',   fn: evaluateWithGemini   },
    { name: 'groq',     fn: evaluateWithGroq     },
  ];

  // Run all in parallel — each wrapped in try/catch so one failure doesn't kill the rest
  const results = await Promise.allSettled(
    providers.map(async ({ name, fn }) => {
      const result = await fn(prompt);
      if (!result) throw new Error(`${name} returned invalid response`);
      return { provider: name, ...result };
    })
  );

  // Collect successful evaluations only
  const evaluations = [];
  results.forEach((result, idx) => {
    if (result.status === 'fulfilled') {
      evaluations.push(result.value);
    } else {
      console.warn(`[AIEvaluation] ${providers[idx].name} failed:`, result.reason?.message);
    }
  });

  if (evaluations.length === 0) {
    throw new Error('All AI providers failed. Please try again.');
  }

  // Average score across all successful providers
  const finalScore = Math.round(
    evaluations.reduce((sum, e) => sum + e.score, 0) / evaluations.length
  );

  return { evaluations, finalScore };
}

module.exports = { evaluateSubmissionWithAI };