import { boundedJson } from './agent.mjs';
export async function verifyModel(model, fetchImpl = fetch) {
  const result = await boundedJson(await fetchImpl('https://openrouter.ai/api/v1/models', { signal: AbortSignal.timeout(10000), redirect: 'error' }), 5000000);
  const found = result.data?.find(item => item.id === model);
  if (!found?.supported_parameters?.includes('tools')) throw new Error('Configured model is unavailable or does not advertise tool support');
  return { id: found.id, tools: true };
}
