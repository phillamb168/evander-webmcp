import { readFileSync } from 'node:fs';
import { createRouteMap, publicUrl } from '@evander-webmcp/contracts';

export function loadConfig(env = process.env) {
  const normalize = value => value?.replace(/\/$/, '');
  const toolBase = normalize(env.TOOL_BASE_URL ?? env.DRUPAL_TOOL_BASE);
  if (env.TOOL_BASE_URL && env.DRUPAL_TOOL_BASE && normalize(env.TOOL_BASE_URL) !== normalize(env.DRUPAL_TOOL_BASE)) throw new Error('TOOL_BASE_URL conflicts with deprecated DRUPAL_TOOL_BASE');
  const origin = normalize(env.SITE_ORIGIN);
  if (!publicUrl(toolBase) || new URL(toolBase).search || new URL(toolBase).hash || !publicUrl(origin) || new URL(origin).origin !== origin || !env.SITE_ID) throw new Error('Configure SITE_ORIGIN, TOOL_BASE_URL and SITE_ID');
  const limit = (value, fallback, ceiling) => {
    const number = Number(value || fallback);
    if (!Number.isSafeInteger(number) || number < 1) throw new Error('Model and token limits must be positive integers');
    return Math.min(ceiling, number);
  };
  const routes = env.ROUTE_MAP_FILE ? JSON.parse(readFileSync(env.ROUTE_MAP_FILE, 'utf8')) : null;
  const routeMap = routes ? createRouteMap({ sourceOrigin: new URL(toolBase).origin, publicOrigin: origin, routes }) : null;
  return { origin, toolBase, siteId: env.SITE_ID, apiKey: env.OPENROUTER_API_KEY, model: env.OPENROUTER_MODEL,
    resolveCurrentPath: routeMap?.resolveCurrentPath,
    maxModelCalls: limit(env.MAX_MODEL_CALLS, 4, 6), maxTurnTokens: limit(env.MAX_TURN_TOKENS, 12000, 30000) };
}
