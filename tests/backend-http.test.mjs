import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import net from 'node:net';
import { once } from 'node:events';

test('Unconfigured reference server enforces browser origin and fails safely without inference', async () => {
  const probe = net.createServer(); probe.listen(0, '127.0.0.1'); await once(probe, 'listening');
  const port = probe.address().port; await new Promise(resolve => probe.close(resolve));
  const child = spawn(process.execPath, ['services/reference-backend/server.mjs'], {
    cwd: new URL('..', import.meta.url), stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, PORT: String(port), LISTEN_HOST: '127.0.0.1', SITE_ORIGIN: 'https://fixture.example', DRUPAL_TOOL_BASE: 'https://fixture.example', SITE_ID: 'fixture', OPENROUTER_API_KEY: '', OPENROUTER_MODEL: '', DEV_TLS_CERT: '', DEV_TLS_KEY: '' },
  });
  const exited = once(child, 'exit'); const output = [];
  child.stdout.on('data', part => output.push(part.toString())); child.stderr.on('data', part => output.push(part.toString()));
  const base = `http://127.0.0.1:${port}`;
  try {
    let health;
    for (let attempt = 0; attempt < 40; attempt++) {
      try { health = await fetch(`${base}/healthz`, { signal: AbortSignal.timeout(250) }); break; }
      catch { if (child.exitCode !== null) throw new Error('Reference server exited'); await new Promise(resolve => setTimeout(resolve, 50)); }
    }
    assert.equal(health?.status, 200); assert.deepEqual(await health.json(), { status: 'ok', inferenceConfigured: false });
    assert.equal((await fetch(`${base}/healthz`, { headers: { Origin: 'https://other.example' } })).status, 403);
    const preflight = await fetch(`${base}/v1/agent`, { method: 'OPTIONS', headers: { Origin: 'https://fixture.example' } });
    assert.equal(preflight.status, 204); assert.equal(preflight.headers.get('Access-Control-Allow-Origin'), 'https://fixture.example');
    assert.equal((await fetch(`${base}/missing`)).status, 404);
    assert.equal((await fetch(`${base}/v1/agent`, { method: 'POST', body: 'not JSON' })).status, 415);
    const answer = await fetch(`${base}/v1/agent`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: 'SYNTHETIC_PRIVATE_SENTINEL', path: '/', siteId: 'fixture' }) });
    assert.equal(answer.status, 503); assert.deepEqual(await answer.json(), { error: 'inference_not_configured' });
    assert.equal(answer.headers.get('Cache-Control'), 'no-store');
    assert.ok(!output.join('').includes('SYNTHETIC_PRIVATE_SENTINEL'));
  } finally { if (child.exitCode === null) child.kill('SIGTERM'); await exited; }
});
