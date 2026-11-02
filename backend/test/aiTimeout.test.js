import test from 'node:test';
import assert from 'node:assert/strict';

process.env.GEMINI_TIMEOUT_MS = '150';

test('a hanging Gemini call fails fast with a retryable 504 and is not retried', async () => {
  const { interpretRoutePrompt } = await import('../src/services/aiRoutePlanner.js');
  let calls = 0;
  const client = { models: { generateContent: () => { calls += 1; return new Promise(() => {}); } } };
  const started = Date.now();
  await assert.rejects(
    interpretRoutePrompt('Evitá peajes y priorizá asfalto.', null, { client }),
    (error) => error.statusCode === 504 && error.retryable === true,
  );
  assert.ok(Date.now() - started < 1_500, 'returns quickly instead of hanging the request');
  assert.equal(calls, 1, 'a timeout is not retried');
});

test('provider 429 is still retried, then reported as retryable', async () => {
  const { interpretRoutePrompt } = await import('../src/services/aiRoutePlanner.js');
  let calls = 0;
  const client = { models: { generateContent: async () => { calls += 1; throw Object.assign(new Error('quota'), { status: 429 }); } } };
  await assert.rejects(
    interpretRoutePrompt('Evitá peajes y priorizá asfalto.', null, { client }),
    (error) => error.statusCode === 429 && error.retryable === true,
  );
  assert.equal(calls, 3, 'rate limits keep their existing retry policy');
});
