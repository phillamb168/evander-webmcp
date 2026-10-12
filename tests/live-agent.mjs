import assert from 'node:assert/strict';
import { Agent } from '../services/reference-backend/agent.mjs';
if (process.env.SITE_ORIGIN !== 'https://evander-preview10.ddev.site') throw new Error('Synthetic fixture site required');
const agent = new Agent({ origin: process.env.SITE_ORIGIN, toolBase: process.env.TOOL_BASE_URL || process.env.DRUPAL_TOOL_BASE, model: process.env.OPENROUTER_MODEL, apiKey: process.env.OPENROUTER_API_KEY, maxModelCalls: 4, maxTurnTokens: 12000, onEvent: event => console.log(JSON.stringify(event)) });
let session;
for (const message of ['Read the current page.', 'What happened in 2010?', 'Show me the fictional care directory demo.']) {
  const answer = await agent.run({ path: '/', message, session }, AbortSignal.timeout(90000));
  session = answer.session;
  console.log(JSON.stringify({ prompt: message, answer: answer.answer, links: answer.links, usage: answer.usage }));
  assert.ok(answer.links.length, 'Expected grounded source links');
}
