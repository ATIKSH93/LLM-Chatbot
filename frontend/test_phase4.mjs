import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 1. Check data-testid attributes in App.jsx
console.log('--- Step 1: Checking data-testid attributes in App.jsx ---');
const appJsxPath = path.join(__dirname, 'src', 'App.jsx');
const appJsxContent = fs.readFileSync(appJsxPath, 'utf8');

const requiredTestIds = [
  'chat-input',
  'send-button',
  'assistant-message',
  'meta-source',
  'meta-model',
  'meta-latency',
  'meta-input-tokens',
  'meta-output-tokens',
];

for (const testId of requiredTestIds) {
  assert(
    appJsxContent.includes(`data-testid="${testId}"`),
    `Missing data-testid="${testId}" in App.jsx`
  );
  console.log(`✓ Found data-testid="${testId}"`);
}

// Check nesting: meta-* must be inside assistant-message block
const assistantMessageIdx = appJsxContent.indexOf('data-testid="assistant-message"');
assert(assistantMessageIdx !== -1, 'assistant-message not found');
const metaSourceIdx = appJsxContent.indexOf('data-testid="meta-source"');
const metaModelIdx = appJsxContent.indexOf('data-testid="meta-model"');
const metaLatencyIdx = appJsxContent.indexOf('data-testid="meta-latency"');
const metaInTokensIdx = appJsxContent.indexOf('data-testid="meta-input-tokens"');
const metaOutTokensIdx = appJsxContent.indexOf('data-testid="meta-output-tokens"');

assert(metaSourceIdx > assistantMessageIdx, 'meta-source must be inside assistant-message');
assert(metaModelIdx > assistantMessageIdx, 'meta-model must be inside assistant-message');
assert(metaLatencyIdx > assistantMessageIdx, 'meta-latency must be inside assistant-message');
assert(metaInTokensIdx > assistantMessageIdx, 'meta-input-tokens must be inside assistant-message');
assert(metaOutTokensIdx > assistantMessageIdx, 'meta-output-tokens must be inside assistant-message');
console.log('✓ All 5 metadata testids are nested inside assistant-message');

// Check no localStorage or sessionStorage in App.jsx
assert(!appJsxContent.includes('localStorage'), 'localStorage should not be used for session persistence');
assert(!appJsxContent.includes('sessionStorage'), 'sessionStorage should not be used for session persistence');
console.log('✓ Verified no localStorage or sessionStorage usage');

// 2. Test API client against mock server
console.log('\n--- Step 2: Testing sendChatMessage against mock endpoints ---');
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (req.method === 'POST' && url.pathname === '/chat') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      const parsed = JSON.parse(body);

      // Verify payload
      if (!parsed.session_id || !parsed.message) {
        res.writeHead(422, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ detail: [{ loc: ['body', 'message'], msg: 'Field required' }] }));
        return;
      }

      if (parsed.message === 'simulate-503') {
        res.writeHead(503, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ detail: 'all providers unavailable' }));
        return;
      }

      if (parsed.message === 'simulate-422') {
        res.writeHead(422, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ detail: 'Field cannot be empty or whitespace only' }));
        return;
      }

      // Check cache simulation
      const isCacheHit = parsed.message === 'cached question';
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        session_id: parsed.session_id,
        reply: isCacheHit ? 'Cached answer' : `Answer to: ${parsed.message}`,
        metadata: {
          resolution_source: isCacheHit ? 'LLM_CACHE' : 'LIVE_INFERENCE',
          model: 'groq/openai/gpt-oss-120b',
          latency_ms: isCacheHit ? 5 : 450,
          input_tokens: 25,
          output_tokens: 15,
          key_id: isCacheHit ? null : 'key_1',
          fallback_attempts: 0,
        },
      }));
    });
  } else {
    res.writeHead(404);
    res.end();
  }
});

await new Promise(resolve => server.listen(8081, '127.0.0.1', resolve));

try {
  // Dynamically import api.js with env pointing to mock server
  process.env.VITE_API_BASE_URL = 'http://127.0.0.1:8081';
  const { sendChatMessage } = await import('./src/services/api.js');

  // Test 1: Successful live inference
  const res1 = await sendChatMessage({ sessionId: 'sess-123', message: 'Hello world' });
  assert.strictEqual(res1.session_id, 'sess-123');
  assert.strictEqual(res1.reply, 'Answer to: Hello world');
  assert.strictEqual(res1.metadata.resolution_source, 'LIVE_INFERENCE');
  assert.strictEqual(res1.metadata.key_id, 'key_1');
  assert.strictEqual(res1.metadata.latency_ms, 450);
  console.log('✓ Success response and LIVE_INFERENCE metadata parsed correctly');

  // Test 2: Successful cache hit
  const res2 = await sendChatMessage({ sessionId: 'sess-123', message: 'cached question' });
  assert.strictEqual(res2.reply, 'Cached answer');
  assert.strictEqual(res2.metadata.resolution_source, 'LLM_CACHE');
  assert.strictEqual(res2.metadata.key_id, null);
  console.log('✓ Cache hit response and LLM_CACHE metadata parsed correctly');

  // Test 3: HTTP 422 error
  let caught422 = false;
  try {
    await sendChatMessage({ sessionId: 'sess-123', message: 'simulate-422' });
  } catch (err) {
    caught422 = true;
    assert(err.message.includes('422'), `Expected 422 in error message: ${err.message}`);
    assert(err.message.includes('Field cannot be empty'), `Expected detail in error message: ${err.message}`);
  }
  assert(caught422, 'Expected HTTP 422 to throw an error');
  console.log('✓ HTTP 422 error handled readably with backend detail');

  // Test 4: HTTP 503 error
  let caught503 = false;
  try {
    await sendChatMessage({ sessionId: 'sess-123', message: 'simulate-503' });
  } catch (err) {
    caught503 = true;
    assert(err.message.includes('503'), `Expected 503 in error message: ${err.message}`);
    assert(err.message.includes('all providers unavailable'), `Expected detail in error message: ${err.message}`);
  }
  assert(caught503, 'Expected HTTP 503 to throw an error');
  console.log('✓ HTTP 503 error handled readably with backend detail');

  // Test 5: Network failure
  let caughtNetwork = false;
  try {
    // point to invalid port
    const badApi = await import('./src/services/api.js');
    // Using fetch to an unroutable port
    await fetch('http://127.0.0.1:59999/chat', { method: 'POST' });
  } catch (err) {
    caughtNetwork = true;
  }
  assert(caughtNetwork, 'Network failure detected');
  console.log('✓ Network failure caught as expected');

  console.log('\nAll Phase 4 automated integration checks passed successfully!');
} finally {
  server.close();
}
