// Opt-in, real inference on synthetic fixture content only. Never customer data.
import assert from 'node:assert/strict';
import { Agent } from '../reference/backend/agent.mjs';
const origin = 'https://evander-preview10.ddev.site';
if (process.env.SITE_ORIGIN !== origin || process.env.DRUPAL_TOOL_BASE !== origin) throw new Error('Synthetic fixture site required');
let events = []; let cost = 0;
const agent = new Agent({ origin, toolBase: origin, model: process.env.OPENROUTER_MODEL, apiKey: process.env.OPENROUTER_API_KEY, maxModelCalls: 4, maxTurnTokens: 12000, onEvent: event => events.push(event) });
for (let run = 1; run <= 3; run++) {
  let session;
  for (const message of ['Find pages matching library. Return their links.', 'What happened in 2010?']) {
    events = [];
    const answer = await agent.run({ path: '/', message, session }, AbortSignal.timeout(90000));
    session = answer.session; cost += answer.usage.cost;
    const calls = events.filter(e => e.operation === 'model_plan').length;
    console.log(JSON.stringify({ run, prompt: message, answer: answer.answer, links: answer.links, events, usage: answer.usage }));
    assert.ok(calls <= 4); assert.ok(answer.usage.tokens <= 12000);
    assert.ok(answer.links.some(link => link.url.startsWith(origin + '/node/1')));
    if (message.includes('2010')) assert.match(answer.answer, /We opened the community library in 2010\./);
  }
}
console.log(JSON.stringify({ status: 'passed', conversations: 3, turns: 6, cost }));
