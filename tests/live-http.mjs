import assert from 'node:assert/strict';
const origin = process.argv[2];
if (!/^https:\/\/evander-preview(?:10|11)\.ddev\.site$/.test(origin || '')) throw new Error('Disposable fixture origin required');
let count = 0;
async function call(name, args, status = 200, extra = {}) {
  const response = await fetch(`${origin}/evander-webmcp/v1/call`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...extra }, body: JSON.stringify({ name, arguments: args }) });
  assert.equal(response.status, status); count++;
  return response.json();
}
const manifest = await (await fetch(`${origin}/evander-webmcp/v1/tools`)).json();
assert.equal(manifest.tools.length, 4); count++;
const page = (await call('evander_read_page', { path: '/node/1' })).result;
assert.equal(page.status, 'ok'); assert.match(JSON.stringify(page), /community library in 2010/); count += 2;
const html = await (await fetch(`${origin}/node/1`)).text();
for (const chunk of page.chunks) if (chunk.anchor) { assert.ok(html.includes(`id="${chunk.anchor.slice(1)}"`), 'Citation anchor exists on rendered page'); count++; }
const home = (await call('evander_get_current_page', { path: '/' })).result;
assert.equal(home.page.title, 'Welcome to the developer preview'); count++;
await call('evander_read_page', { path: '/node/3' }, 404);
await call('evander_read_page', { path: '/admin' }, 404);
await call('evander_read_page', { path: 'https://evil.example' }, 400);
await call('evander_read_page', { path: '/node/1', extra: true }, 400);
await call('delete_node', { id: 1 }, 403);
await call('evander_read_page', { path: '/node/1' }, 403, { Origin: 'https://evil.example' });
const discovered = (await call('evander_find_pages', {})).result;
assert.ok(discovered.results.length >= 2); assert.ok(!JSON.stringify(discovered).includes('confidential')); count += 2;
let next = { path: '/node/2' }; let pages = 0; let found = false;
while (next && pages < 20) {
  const data = (await call('evander_read_page', next)).result;
  assert.ok(Buffer.byteLength(JSON.stringify(data)) <= 60000); count++;
  found ||= JSON.stringify(data.chunks).includes('END_OF_LONG_COMPONENT');
  if (data.next) assert.ok(data.next.offset > (next.offset ?? 0));
  next = data.next; pages++;
}
assert.ok(pages > 1 && !next && found, 'Long component fully retrieved using continuation'); count++;
const stale = (await call('evander_read_page', { path: '/node/2', offset: 2, snapshot: 'invalid' })).result;
assert.equal(stale.status, 'stale'); count++;
const custom = (await call('get_care_now', {})).result;
assert.equal(custom.fictional, true); assert.equal(custom.items.length, 2); count += 2;
console.log(`${origin}: ${count} HTTP/content assertions passed; ${pages} continuation responses.`);
