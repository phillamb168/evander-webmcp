import { boundedJson, TOOL_PATHS, validateManifest, validateEnvelope } from '@evander-webmcp/contracts';

export function send(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  res.end(JSON.stringify(data));
}
export async function readCall(req) {
  if (!req.headers['content-type']?.startsWith('application/json')) throw Object.assign(new Error('json_required'), { status: 415 });
  const parts = []; let size = 0;
  for await (const part of req) { size += part.length; if (size > 16384) throw Object.assign(new Error('request_too_large'), { status: 413 }); parts.push(part); }
  let body; try { body = JSON.parse(Buffer.concat(parts).toString('utf8')); } catch { throw new Error('invalid_input'); }
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(key => !['name', 'arguments'].includes(key)) || typeof body.name !== 'string' || !body.arguments || typeof body.arguments !== 'object' || Array.isArray(body.arguments)) throw new Error('invalid_input');
  return body;
}
export function toolMiddleware({ origin, manifest, call }) {
  return async (req, res, next) => {
    if (![TOOL_PATHS.manifest, TOOL_PATHS.call].includes(req.url)) return next();
    if (req.headers.origin && req.headers.origin !== origin) return send(res, 403, { error: 'origin_not_allowed' });
    const timer = setTimeout(() => req.destroy(), 5000);
    try {
      if (req.method === 'GET' && req.url === TOOL_PATHS.manifest) return send(res, 200, await manifest());
      if (req.method !== 'POST' || req.url !== TOOL_PATHS.call) return send(res, 405, { error: 'method_not_allowed' });
      const body = await readCall(req); return send(res, 200, await call(body));
    } catch (error) { return send(res, error.status ?? 400, { error: error.status === 502 ? 'upstream_unavailable' : 'invalid_input' }); }
    finally { clearTimeout(timer); }
  };
}

/** Development example: exactly two fixed upstream endpoints; never a URL proxy. */
export function fixedToolProxy({ origin, toolBase, fetchImpl = fetch }) {
  const base = new URL(toolBase);
  if (!['https:', 'http:'].includes(base.protocol) || base.username || base.password || base.search || base.hash) throw new Error('Invalid fixed tool base');
  const upstream = async (path, body) => {
    try {
      const response = await fetchImpl(toolBase.replace(/\/$/, '') + path, {
        method: body ? 'POST' : 'GET', signal: AbortSignal.timeout(4500), credentials: 'omit', redirect: 'error',
        headers: { Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      return await boundedJson(response);
    } catch { throw Object.assign(new Error('upstream_unavailable'), { status: 502 }); }
  };
  return toolMiddleware({ origin, manifest: async () => validateManifest(await upstream(TOOL_PATHS.manifest)), call: async body => {
    const manifest = validateManifest(await upstream(TOOL_PATHS.manifest));
    if (!manifest.tools.some(tool => tool.name === body.name)) throw new Error('unknown_tool');
    return validateEnvelope(await upstream(TOOL_PATHS.call, body));
  } });
}
