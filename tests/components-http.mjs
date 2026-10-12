import assert from 'node:assert/strict';
const origin = process.argv[2];
if (!/^https:\/\/evander-preview(?:10|11)\.ddev\.site$/.test(origin || '')) throw new Error('Fixture required');
async function read(path) {
  const response = await fetch(`${origin}/evander-webmcp/v1/call`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'evander_read_page', arguments: { path } }) });
  assert.equal(response.status, 200); return (await response.json()).result;
}
let assertions = 0;
for (const [path, expected] of [['/node/4', 'PARAGRAPH_PUBLIC_SENTINEL'], ['/node/6', 'LAYOUT_PUBLIC_SENTINEL']]) {
  const result = await read(path); assert.match(JSON.stringify(result.chunks), new RegExp(expected)); assertions++;
  const html = await (await fetch(origin + path)).text();
  for (const chunk of result.chunks) if (chunk.anchor) { assert.ok(html.includes(`id="${chunk.anchor.slice(1)}"`), `Real anchor ${chunk.anchor}`); assertions++; }
  if (path === '/node/6') { assert.match(JSON.stringify(result.chunks), /BLOCK_PUBLIC_SENTINEL/); assertions++; }
}
assert.ok(!JSON.stringify(await read('/node/5')).includes('PRIVATE_PARAGRAPH_SENTINEL')); assertions++;
assert.ok(!JSON.stringify(await read('/node/1')).includes('BLOCK_PUBLIC_SENTINEL')); assertions++;
console.log(`${origin}: ${assertions} paragraph/layout/block assertions passed.`);
