#!/usr/bin/env node
/**
 * Test script: verify the proxy URL used by anime-world is working.
 * Run from repo root: node scripts/test-proxy.js
 * Or: pnpm run test:proxy
 *
 * 1) Checks if the Railway/base URL exists (GET /health).
 * 2) If base is OK, tests the proxy (GET proxy?url=...).
 *
 * To confirm your proxy URL: Railway Dashboard → aniwatch-api service → copy the
 * public URL (e.g. https://xxx.up.railway.app). Proxy URL = that + /api/v2/proxy
 */

const fs = require('fs');
const path = require('path');

const DEFAULT_PROXY_BASE = 'https://aniwatch-api-production-d3be.up.railway.app/api/v2/proxy';
const TIMEOUT_MS = 20000;
const PROXY_TEST_TIMEOUT_MS = 120000; // Step 2: 2 min (slow networks; Railway responds in ~1s but response can be slow to reach client)

function loadProxyUrlFromEnvFile() {
  const envPath = path.join(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) return null;
  const content = fs.readFileSync(envPath, 'utf8');
  const match = content.match(/NEXT_PUBLIC_PROXY_URL\s*=\s*(.+)/);
  if (!match) return null;
  return match[1].replace(/^["']|["']\s*$/g, '').trim();
}

function getProxyBase() {
  return (
    process.env.PROXY_URL ||
    process.env.NEXT_PUBLIC_PROXY_URL ||
    loadProxyUrlFromEnvFile() ||
    DEFAULT_PROXY_BASE
  );
}

/** Get API base URL (no path): https://host/api/v2/proxy -> https://host */
function getApiBaseUrl(proxyBase) {
  try {
    const u = new URL(proxyBase);
    const pathname = u.pathname.replace(/\/api\/v2\/proxy\/?$/, '') || '/';
    u.pathname = pathname;
    return u.toString().replace(/\/$/, '') || u.origin;
  } catch {
    return null;
  }
}

function fetchWithTimeout(url, ms) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), ms);
  return fetch(url, { method: 'GET', signal: controller.signal }).finally(() => clearTimeout(timeoutId));
}

async function testProxy() {
  const proxyBase = getProxyBase();
  const apiBase = getApiBaseUrl(proxyBase);
  const healthUrl = apiBase ? `${apiBase}/health` : null;

  console.log('Proxy test');
  console.log('----------');
  console.log('Proxy URL (from .env.local or default):', proxyBase);
  console.log('API base (derived):', apiBase || '(could not derive)');
  console.log('');

  // Step 1: Confirm base URL exists
  if (healthUrl) {
    console.log('Step 1: Checking if API base URL exists (GET', healthUrl + ')...');
    const startHealth = Date.now();
    try {
      const healthRes = await fetchWithTimeout(healthUrl, TIMEOUT_MS);
      const elapsed = Date.now() - startHealth;
      if (healthRes.ok) {
        console.log('  Base URL is reachable. Status:', healthRes.status, 'Time:', elapsed + 'ms');
      } else {
        console.log('  Base URL responded but not OK. Status:', healthRes.status, 'Time:', elapsed + 'ms');
      }
    } catch (err) {
      console.log('  Base URL unreachable.');
      console.log('');
      console.log('  This usually means:');
      console.log('  - The URL is wrong or the Railway service was renamed/redeployed.');
      console.log('  - Railway Dashboard → your aniwatch-api service → copy the current public URL.');
      console.log('  - Set NEXT_PUBLIC_PROXY_URL to that URL + /api/v2/proxy (e.g. https://YOUR-APP.up.railway.app/api/v2/proxy)');
      console.log('  - Or your network is blocking/firewalling Railway.');
      if (err.name === 'AbortError') {
        console.log('  (Request timed out after', TIMEOUT_MS / 1000, 's)');
      } else {
        console.log('  Error:', err.message);
      }
      process.exit(1);
    }
    console.log('');
  }

  // Step 2: Test proxy (use axios for longer timeout; Node fetch has ~10s connect limit)
  const testTargetUrl = 'https://ipv4.icanhazip.com';
  const proxyUrl = `${proxyBase}${proxyBase.includes('?') ? '&' : '?'}url=${encodeURIComponent(testTargetUrl)}`;
  console.log('Step 2: Testing proxy (GET target via proxy)...');
  console.log('  Target:', testTargetUrl);
  console.log('  Timeout:', PROXY_TEST_TIMEOUT_MS / 1000 + 's');
  console.log('');

  const start = Date.now();
  try {
    let body;
    let status;
    try {
      const axios = require('axios');
      const res = await axios.get(proxyUrl, {
        timeout: PROXY_TEST_TIMEOUT_MS,
        responseType: 'text',
        validateStatus: () => true,
      });
      status = res.status;
      body = res.data;
    } catch (axiosErr) {
      if (axiosErr.response !== undefined) {
        status = axiosErr.response.status;
        body = axiosErr.response.data;
      } else {
        throw axiosErr;
      }
    }
    const elapsed = Date.now() - start;

    if (status >= 200 && status < 300) {
      console.log('Result: OK');
      console.log('Status:', status, 'Time:', elapsed + 'ms');
      console.log('Body (first 200 chars):', String(body).slice(0, 200).replace(/\n/g, ' '));
      if (String(body).trim()) console.log('(If using IPRoyal, the IP above should be a residential IP.)');
      process.exit(0);
    } else {
      console.log('Result: FAIL');
      console.log('Status:', status, 'Time:', elapsed + 'ms');
      if (body) console.log('Body:', String(body).slice(0, 300));
      process.exit(1);
    }
  } catch (err) {
    const elapsed = Date.now() - start;
    console.log('Result: ERROR');
    console.log('Time:', elapsed + 'ms');
    if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
      console.error('Error: Request timed out after', PROXY_TEST_TIMEOUT_MS / 1000, 's.');
    } else {
      console.error('Error:', err.message);
      if (err.cause) console.error('Cause:', err.cause);
    }
    process.exit(1);
  }
}

testProxy();
