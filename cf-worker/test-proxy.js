/**
 * Quick test script for the deployed Cloudflare Worker proxy.
 * Run: node test-proxy.js
 */

const WORKER_URL = 'https://anime-world-proxy.anime-world-proxy.workers.dev/proxy';

async function test(name, url, expectedStatus) {
  try {
    const full = url ? `${WORKER_URL}?url=${encodeURIComponent(url)}` : WORKER_URL;
    const res = await fetch(full, { method: 'GET' });
    const text = await res.text();
    const pass = expectedStatus != null ? res.status === expectedStatus : res.ok;
    const ok = pass ? '✓' : '✗';
    console.log(`${ok} ${name}: ${res.status} ${res.statusText}`);
    if (text.length < 200) console.log('   Body:', text.trim());
    else console.log('   Body length:', text.length);
    return pass;
  } catch (e) {
    console.log('✗', name, 'Error:', e.message);
    return false;
  }
}

async function main() {
  console.log('Testing Worker:', WORKER_URL);
  console.log('---');

  await test('No url param (expect 400)', null, 400);
  await test('With url=https://example.com', 'https://example.com');
  await test('With url=https://httpbin.org/get', 'https://httpbin.org/get');

  console.log('---');
  console.log('Done. If you see 400 for first, 200/301 for others, Worker is working.');
}

main();
