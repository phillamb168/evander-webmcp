import test from 'node:test';
import assert from 'node:assert/strict';
import { Agent, ReasoningLimitError, boundedSourceGroups } from '../reference/backend/agent.mjs';

const origin = 'https://fixture.example';
const toolNames = ['evander_find_pages', 'evander_read_page', 'evander_get_current_page', 'get_care_now'];
const manifest = { tools: toolNames.map(name => ({ name, inputSchema: { type: 'object' } })) };
const plan = (name, args) => ({ choices: [{ message: { tool_calls: [{ id: 'call', function: { name, arguments: JSON.stringify(args) } }] } }], usage: { total_tokens: 10 } });
const quote = id => plan('evander_respond', { mode: 'quote', sourceIds: [id] });
const page = (path, chunks, next = null) => ({ status: 'ok', coverage: 'partial', page: { title: 'Public fixture', url: origin + path }, chunks, next });
const answerChunk = { id: 'history', heading: 'History', text: 'The community library opened in 2010.', anchor: '#history' };
const answerId = `page:${origin}/library:history`;
function harness(model, lookup, maxModelCalls = 4) {
  const requests = []; const lookups = [];
  const agent = new Agent({ origin, toolBase: origin, maxModelCalls, maxTurnTokens: 12000 }, async (url, options) => {
    if (url.endsWith('/tools')) return Response.json(manifest);
    const body = JSON.parse(options.body);
    if (url.endsWith('/call')) { lookups.push(body); return Response.json({ result: await lookup(body) }); }
    requests.push(body); return Response.json(await model(body, requests.length));
  });
  return { agent, requests, lookups };
}
test('Discovery → 2010 follow-up finishes within four calls even after an unnecessary large-page read', async () => {
  const run = harness((request, n) => {
    if (n === 1) return plan('evander_find_pages', { query: 'library' });
    if (n === 2) return plan('evander_respond', { mode: 'links', sourceIds: [`link:${origin}/library`] });
    if (n === 3) return plan('evander_find_pages', { query: '2010' });
    if (n === 4) return plan('evander_get_current_page', { path: '/wrong-model-path' });
    if (n === 5) return plan('evander_read_page', { path: '/long-timeline' });
    assert.deepEqual(request.tools.map(t => t.function.name), ['evander_respond']);
    assert.equal(request.tool_choice.function.name, 'evander_respond');
    assert.ok(!request.messages.some(m => m.role === 'tool' || m.tool_calls));
    assert.ok(JSON.stringify(request.messages).includes(answerId));
    return quote(answerId);
  }, ({ name, arguments: args }) => {
    if (name === 'evander_find_pages') return { status: 'ok', results: [{ label: 'Library', url: origin + '/library' }] };
    if (name === 'evander_get_current_page') { assert.equal(args.path, '/library'); return page('/library', [answerChunk]); }
    return page('/long-timeline', Array.from({ length: 60 }, (_, i) => ({ id: String(i), text: 'Unrelated public material. '.repeat(24), heading: 'Timeline' })));
  });
  const first = await run.agent.run({ path: '/library', message: 'Find pages matching library. Return their links.' });
  const second = await run.agent.run({ path: '/library', message: 'What happened in 2010?', session: first.session });
  assert.match(second.answer, /library opened in 2010/);
  assert.deepEqual(second.links, [{ label: 'Public fixture — History', url: origin + '/library#history' }]);
  assert.equal(run.requests.length, 6); assert.equal(second.usage.tokens, 40);
});
test('A sufficient answer finishes early; no compulsory extra model or retrieval calls', async () => {
  const run = harness((req, n) => n === 1 ? plan('evander_read_page', { path: '/library' }) : quote(answerId), () => page('/library', [answerChunk]));
  await run.agent.run({ path: '/', message: 'What happened in 2010?' });
  assert.equal(run.requests.length, 2); assert.equal(run.lookups.length, 1);
});
test('Missing evidence can still be read from a genuine continuation', async () => {
  const run = harness((req, n) => n === 1 ? plan('evander_read_page', { path: '/library' }) : n === 2 ? plan('evander_read_page', { path: '/library', offset: 1, snapshot: 'fixture' }) : quote(answerId), ({ arguments: args }) => args.offset === 1 ? page('/library', [answerChunk]) : page('/library', [{ id: 'intro', heading: 'Intro', text: 'Welcome.' }], { offset: 1, snapshot: 'fixture' }));
  const result = await run.agent.run({ path: '/', message: 'What happened in 2010?' });
  assert.match(result.answer, /opened in 2010/); assert.equal(run.lookups.length, 2);
});
test('Repeated successful page segments are not fetched again; continuation stays available', async () => {
  const run = harness((req, n) => {
    if (n < 3) return plan('evander_read_page', { path: '/library' });
    assert.match(req.messages.at(-1).content, /already_read/);
    assert.match(req.messages.at(-1).content, /snapshot/);
    return quote(answerId);
  }, () => page('/library', [answerChunk], { offset: 1, snapshot: 'fixture' }));
  await run.agent.run({ path: '/', message: 'What happened in 2010?' });
  assert.equal(run.lookups.length, 1); assert.equal(run.requests.length, 3);
});
test('Dynamic custom data is refreshed, not suppressed by the static-page duplicate guard', async () => {
  const run = harness((req, n) => n % 2 ? plan('get_care_now', {}) : quote('item:get_care_now:north'), () => ({ status: 'ok', items: [{ id: 'north', label: 'North', facts: [{ label: 'Estimate', value: `${run.lookups.length} minutes` }], links: [{ label: 'Reserve My Spot', url: origin + '/reserve' }] }] }));
  const first = await run.agent.run({ path: '/', message: 'Current waits?' });
  const second = await run.agent.run({ path: '/', message: 'Refresh current waits', session: first.session });
  assert.match(second.answer, /2 minutes/); assert.doesNotMatch(second.answer, /1 minutes/);
  assert.equal(run.lookups.length, 2); assert.equal(second.links[0].url, origin + '/reserve');
});
test('Final-only enforcement rejects more lookups even when a provider ignores the declared tool set', async () => {
  const run = harness(() => plan('evander_read_page', { path: '/library' }), () => { throw new Error('Must not execute'); }, 1);
  await assert.rejects(run.agent.run({ path: '/', message: 'Read' }), ReasoningLimitError);
  assert.equal(run.lookups.length, 0); assert.equal(run.requests.length, 1); assert.equal(run.agent.sessions.size, 0);
});
test('Insufficient or discovery-only evidence is not forced into an answer at the final stage', async () => {
  const run = harness((req, n) => n === 1 ? plan('evander_find_pages', { query: 'unverifiable' }) : plan('evander_respond', { mode: 'not_found', sourceIds: [] }), () => ({ status: 'ok', results: [{ label: 'Unrelated page', url: origin + '/unrelated' }] }), 2);
  const result = await run.agent.run({ path: '/', message: 'What happened in 9999?' });
  assert.match(result.answer, /could not verify/); assert.deepEqual(result.links, []);
});
test('An answer cannot bypass a mixed lookup batch or invalid source verification', async () => {
  const run = harness(() => ({ choices: [{ message: { tool_calls: [...plan('evander_find_pages', {}).choices[0].message.tool_calls, ...quote('made-up').choices[0].message.tool_calls] } }] }), () => { throw new Error('Must not execute'); });
  await assert.rejects(run.agent.run({ path: '/', message: 'Read' }), /sole tool call/);
  assert.equal(run.lookups.length, 0);
  const invalid = harness(() => quote('made-up'), () => ({}), 1);
  await assert.rejects(invalid.agent.run({ path: '/', message: 'Read' }), /Unverified source/);
});
test('Bounded interleaving preserves small evidence, latest versions, and the original byte ceiling', () => {
  const old = [{ id: 'wait', text: 'stale' }, { id: 'history', text: 'Opened in 2010.' }];
  const fresh = [...Array.from({ length: 60 }, (_, i) => ({ id: String(i), text: 'x'.repeat(1000) })), { id: 'wait', text: 'fresh' }];
  const result = boundedSourceGroups([old, fresh]);
  assert.ok(Buffer.byteLength(JSON.stringify(result)) <= 18000);
  assert.ok(result.some(r => r.id === 'history')); assert.ok(!result.some(r => r.text === 'stale'));
  assert.equal(new Set(result.map(r => r.id)).size, result.length);
});
