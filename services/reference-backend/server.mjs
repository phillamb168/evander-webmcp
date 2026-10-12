import http from 'node:http';
import https from 'node:https';
import { readFileSync } from 'node:fs';
import { Agent, ReasoningLimitError } from './agent.mjs';
import { verifyModel } from './model.mjs';
import { loadConfig } from './config.mjs';

const config = loadConfig();
const agent = new Agent(config); const rates = new Map();
if (config.apiKey && config.model) await verifyModel(config.model);
const handler = async (req, res) => {
  const origin = req.headers.origin;
  const send = (code, data) => { res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(data)); };
  if (origin && origin !== config.origin) return send(403, { error: 'origin_not_allowed' });
  if (origin) { res.setHeader('Access-Control-Allow-Origin', origin); res.setHeader('Vary', 'Origin'); }
  if (req.method === 'OPTIONS') { res.setHeader('Access-Control-Allow-Headers', 'content-type'); res.setHeader('Access-Control-Allow-Methods', 'POST'); return send(204, null); }
  if (req.url === '/healthz') return send(200, { status: 'ok', inferenceConfigured: Boolean(config.apiKey && config.model) });
  if (req.method !== 'POST' || req.url !== '/v1/agent') return send(404, { error: 'not_found' });
  if (!req.headers['content-type']?.startsWith('application/json')) return send(415, { error: 'json_required' });
  if (!config.apiKey || !config.model) return send(503, { error: 'inference_not_configured' });
  const now = Date.now(); for (const [key, v] of rates) if (v.until < now) rates.delete(key);
  const key = req.socket.remoteAddress; const rate = rates.get(key) ?? { count: 0, until: now + 60000 };
  if (++rate.count > 10) return send(429, { error: 'rate_limited' }); rates.set(key, rate);
  const abort = new AbortController(); const timer = setTimeout(() => abort.abort(), 90000);
  res.on('close', () => { if (!res.writableEnded) abort.abort(); });
  try {
    let bytes = 0; const chunks = [];
    for await (const part of req) { bytes += part.length; if (bytes > 8192) return send(413, { error: 'request_too_large' }); chunks.push(part); }
    let body;
    try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { return send(400, { error: 'invalid_input' }); }
    if (!body || body.siteId !== config.siteId || typeof body.message !== 'string' || !body.message.trim() || body.message.length > 2000 || typeof body.path !== 'string' || body.path.length > 2048 || !/^\/(?!\/)[^?#\s\\]*$/.test(body.path)) return send(400, { error: 'invalid_input' });
    const result = await agent.run(body, abort.signal);
    // Metadata only: never log prompt, session credential, tool arguments or result.
    console.info(JSON.stringify({ operation: 'agent', outcome: 'ok', ms: Date.now() - now, ...result.usage }));
    return send(200, result);
  } catch (error) {
    const limited = error instanceof ReasoningLimitError;
    console.info(JSON.stringify({ operation: 'agent', outcome: limited ? 'reasoning_limit' : 'error', ms: Date.now() - now }));
    return send(limited ? 422 : 502, { error: limited ? 'reasoning_limit' : 'assistant_unavailable' });
  } finally { clearTimeout(timer); }
};
const server = process.env.DEV_TLS_CERT && process.env.DEV_TLS_KEY
  ? https.createServer({ cert: readFileSync(process.env.DEV_TLS_CERT), key: readFileSync(process.env.DEV_TLS_KEY) }, handler)
  : http.createServer(handler);
server.listen(Number(process.env.PORT || 8180), process.env.LISTEN_HOST || '127.0.0.1');
