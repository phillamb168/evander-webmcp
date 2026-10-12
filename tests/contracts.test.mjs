import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateManifest, validateEnvelope, createRouteMap, validPath } from '@evander-webmcp/contracts';
import { loadConfig } from '../services/reference-backend/config.mjs';
import { execute, manifest, pages } from '../examples/standalone/adapter.mjs';
const fixtures = JSON.parse(readFileSync(new URL('../packages/contracts/fixtures.json', import.meta.url)));
test('Versioned compatibility fixtures and standalone manifest use the shared contracts', () => {
  validateManifest(fixtures.manifest); validateManifest(manifest);
  for (const key of ['page','custom','stale']) validateEnvelope(fixtures[key]);
  for (const value of [{ version: '2.0', tools: [] }, { tools: [fixtures.manifest.tools[0],fixtures.manifest.tools[0]] }, { tools: [{ name: 'evander_navigate', inputSchema: {type:'object'} }] }]) assert.throws(()=>validateManifest(value));
  for (const value of [{version:'2.0',result:{}},{result:null},{result:{chunks:'bad'}},{result:{coverage:'invented'}},{result:{status:'invented'}}]) assert.throws(()=>validateEnvelope(value));
});
test('Generic backend configuration retains the old alias and rejects conflicts', () => {
  const base={SITE_ORIGIN:'https://frontend.example',SITE_ID:'demo'};
  assert.equal(loadConfig({...base,TOOL_BASE_URL:'https://tools.example/'}).toolBase,'https://tools.example');
  assert.equal(loadConfig({...base,DRUPAL_TOOL_BASE:'https://tools.example'}).toolBase,'https://tools.example');
  assert.equal(loadConfig({...base,TOOL_BASE_URL:'https://tools.example',DRUPAL_TOOL_BASE:'https://tools.example/'}).maxModelCalls,4);
  assert.throws(()=>loadConfig({...base,TOOL_BASE_URL:'https://a.example',DRUPAL_TOOL_BASE:'https://b.example'}),/conflicts/);
  assert.throws(()=>loadConfig({...base,TOOL_BASE_URL:'https://user:secret@tools.example'}));
  for (const override of [{TOOL_BASE_URL:'https://tools.example?key=x'},{MAX_MODEL_CALLS:'NaN'},{MAX_TURN_TOKENS:'-1'},{MAX_MODEL_CALLS:'1.5'}]) assert.throws(()=>loadConfig({...base,TOOL_BASE_URL:'https://tools.example',...override}));
});
test('Trusted route mapping handles aliases and sections without inventing mappings', () => {
  const map=createRouteMap({sourceOrigin:'https://content.example',publicOrigin:'https://frontend.example',routes:[{path:'/about',sourcePath:'/node/1',sourceAliases:['/history'],anchors:{'#old':'#new'}}]});
  assert.equal(map.resolveCurrentPath('/about'),'/node/1'); assert.equal(map.resolveCurrentPath('/missing'),null);
  assert.equal(map.mapSourceUrl('https://content.example/history#old'),'https://frontend.example/about#new');
  for(const value of ['https://content.example/missing','https://content.example/node/1#unknown','https://content.example/node/1?token=x','https://elsewhere.example/history']) assert.equal(map.mapSourceUrl(value),value);
  assert.equal(map.mapSourceUrl('javascript:alert(1)'),null);
  assert.throws(()=>createRouteMap({sourceOrigin:'https://content.example',publicOrigin:'https://frontend.example',routes:[{path:'//attacker.example',sourcePath:'/node/1'}]}));
  assert.equal(validPath('/../secret'),false);
});
test('Non-CMS adapter: public search, sections, complete continuation and unavailable pages', () => {
  const origin='https://fixture.example';
  const call=(name,args={})=>validateEnvelope(execute({name,arguments:args},origin)).result;
  const discovered=call('evander_find_pages',{query:'library'}); assert.ok(discovered.results.length); assert.ok(discovered.nextOffset);
  assert.equal(call('evander_read_page',{path:'/'}).chunks[1].text,'We opened the community library in 2010.');
  let next={path:'/history'}, chunks=[]; while(next) {const result=call('evander_read_page',next); chunks.push(...result.chunks); next=result.next;}
  assert.equal(chunks.length,pages[1].sections.length); assert.ok(chunks.every(chunk=>pages[1].sections.some(section=>chunk.anchor==='#'+section.id)));
  assert.equal(call('evander_read_page',{path:'/missing'}).status,'unavailable');
  assert.equal(call('evander_read_page',{path:'/history',offset:2,snapshot:'old'}).status,'stale');
  assert.equal(call('example_opening_hours').items.length,2);
  for(const [name,args] of [['delete',{}],['evander_read_page',{path:'//elsewhere'}],['evander_read_page',{path:'/history',offset:2}],['evander_find_pages',{query:4}],['example_opening_hours',{extra:true}]]) assert.throws(()=>call(name,args));
});
