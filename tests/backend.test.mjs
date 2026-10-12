import test from 'node:test';
import assert from 'node:assert/strict';
import { checkedUrl, sourceRecords, renderAnswer, boundedSources, boundedJson, Agent } from '../reference/backend/agent.mjs';
import { verifyModel } from '../reference/backend/model.mjs';
const origin = 'https://example.org';
test('Only real source URLs are accepted', () => {
  for (const value of [undefined, null, '', 'javascript:alert(1)', 'https://user:pass@example.org', 'https://example.org/\nwrong']) assert.equal(checkedUrl(value, origin), null);
  assert.equal(checkedUrl('/history', origin), `${origin}/history`);
  assert.deepEqual(sourceRecords({ chunks: [{ id: 'a', text: 'No page URL' }] }, origin), []);
});
test('Responses use verified passages and section URLs, never model URLs', () => {
  const sources = sourceRecords({ page: { url: `${origin}/history`, title: 'History' }, chunks: [{ id: 'a', text: 'Founded in 2010.', heading: 'Timeline', anchor: '#timeline' }] }, origin);
  const answer = renderAnswer({ mode: 'quote', sourceIds: [sources[0].id], url: 'https://attacker.example' }, sources, origin);
  assert.match(answer.answer, /Founded in 2010/); assert.equal(answer.links[0].url, `${origin}/history#timeline`);
  assert.throws(() => renderAnswer({ mode: 'quote', sourceIds: ['invented'] }, sources, origin));
});
test('Discovery alone cannot ground an answer', () => {
  const sources = sourceRecords({ results: [{ label: 'History', url: `${origin}/history` }] }, origin);
  assert.throws(() => renderAnswer({ mode: 'quote', sourceIds: [sources[0].id] }, sources, origin));
});
test('Shared action destination retains each item-specific clickable label', () => {
  const sources = sourceRecords({ items: ['North', 'South'].map(id => ({ id, label: id, facts: [{ label: 'Action', value: 'Check online' }], links: [{ label: `${id} — Check online`, url: `${origin}/scheduling` }] })) }, origin, 'example');
  const answer = renderAnswer({ mode: 'quote', sourceIds: sources.map(s => s.id) }, sources, origin);
  assert.equal(answer.links.length, 2);
  assert.deepEqual(answer.links.map(link => link.label), ['North — Check online', 'South — Check online']);
  assert.ok(answer.links.every(link => link.url === `${origin}/scheduling`));
});
test('Context bound preserves valid records', () => {
  const selected = boundedSources(Array.from({ length: 100 }, (_, i) => ({ id: String(i), text: 'a'.repeat(500) })), 1500);
  assert.ok(Buffer.byteLength(JSON.stringify(selected)) < 1500); assert.ok(selected.length > 0);
});
test('Unknown model tool never reaches Drupal', async () => {
  let calls = 0;
  const agent = new Agent({ origin, toolBase: origin, maxModelCalls: 2, maxTurnTokens: 10000 }, async () => {
    calls++;
    return Response.json(calls === 1 ? { tools: [] } : { choices: [{ message: { tool_calls: [{ id: '1', function: { name: 'delete_content', arguments: '{}' } }] } }] });
  });
  await assert.rejects(agent.run({ message: 'Delete', path: '/' }), /Unknown tool/); assert.equal(calls, 2);
});
test('HTTP errors, malformed JSON and oversized upstream data fail closed', async () => {
  await assert.rejects(boundedJson(new Response('sensitive upstream detail', { status: 503 })), /Upstream HTTP 503/);
  await assert.rejects(boundedJson(new Response('not JSON')), SyntaxError);
  await assert.rejects(boundedJson(Response.json({ text: 'a'.repeat(200) }), 100), /Response limit/);
});
test('Model selection requires advertised tool support', async () => {
  await assert.rejects(verifyModel('example/model', async () => Response.json({ data: [{ id: 'example/model', supported_parameters: [] }] })), /does not advertise tool support/);
  assert.deepEqual(await verifyModel('example/model', async () => Response.json({ data: [{ id: 'example/model', supported_parameters: ['tools'] }] })), { id: 'example/model', tools: true });
});
test('Cross-origin React clients retain Drupal discovery without allowing foreign results', async () => {
  const toolBase = 'https://content.example'; const url = `${toolBase}/history`; let calls = 0;
  const agent = new Agent({ origin, toolBase, maxModelCalls: 2, maxTurnTokens: 10000 }, async (endpoint, options) => {
    calls++;
    if (calls === 1) return Response.json({ tools: [{ name: 'evander_find_pages', inputSchema: { type: 'object' } }] });
    if (calls === 2) return Response.json({ choices: [{ message: { tool_calls: [{ id: '1', function: { name: 'evander_find_pages', arguments: '{"query":"history"}' } }] } }] });
    if (calls === 3) { assert.equal(endpoint, `${toolBase}/evander-webmcp/v1/call`); return Response.json({ result: { results: [{ label: 'History', url }, { label: 'Wrong origin', url: 'https://elsewhere.example/history' }] } }); }
    const sent = JSON.parse(options.body);
    const context = sent.messages.find(m => m.content?.startsWith('Application context'));
    const projection = JSON.parse(context.content.slice(context.content.indexOf('{'))).retainedSources;
    assert.equal(projection.length, 1); assert.equal(projection[0].url, url);
    return Response.json({ choices: [{ message: { tool_calls: [{ id: '2', function: { name: 'evander_respond', arguments: JSON.stringify({ mode: 'links', sourceIds: [`link:${url}`] }) } }] } }] });
  });
  const answer = await agent.run({ path: '/', message: 'Find history' });
  assert.deepEqual(answer.links, [{ label: 'History', url }]); assert.equal(calls, 4);
});
test('Provider failure or cancellation creates no successful conversation', async () => {
  const config = { origin, toolBase: origin, maxModelCalls: 2, maxTurnTokens: 10000 };
  const unavailable = new Agent(config, async () => new Response('private error details', { status: 502 }));
  await assert.rejects(unavailable.run({ message: 'Read', path: '/' }), /Upstream HTTP 502/);
  assert.equal(unavailable.sessions.size, 0);
  const abort = new AbortController(); abort.abort();
  const cancelled = new Agent(config, async (url, options) => { options.signal.throwIfAborted(); });
  await assert.rejects(cancelled.run({ message: 'Read', path: '/' }, abort.signal), { name: 'AbortError' });
  assert.equal(cancelled.sessions.size, 0);
});
test('Model token and loop limits stop without inventing a response', async () => {
  const config = { origin, toolBase: origin, maxModelCalls: 1, maxTurnTokens: 10 };
  let calls = 0;
  const overBudget = new Agent(config, async () => Response.json(++calls === 1 ? { tools: [] } : { usage: { total_tokens: 11 }, choices: [] }));
  await assert.rejects(overBudget.run({ message: 'Read', path: '/' }), /Turn token limit/);
  assert.equal(calls, 2); assert.equal(overBudget.sessions.size, 0);
  const noCalls = new Agent({ ...config, maxModelCalls: 0 }, async () => Response.json({ tools: [] }));
  await assert.rejects(noCalls.run({ message: 'Read', path: '/' }), /Tool loop limit/);
});
