import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { validPath, VERSION } from '@evander-webmcp/contracts';
export const pages = JSON.parse(readFileSync(new URL('./content.json', import.meta.url), 'utf8'));
const object = properties => ({ type: 'object', properties, additionalProperties: false });
const pageSchema = { ...object({ path: { type: 'string', maxLength: 2048 }, offset: { type: 'integer', minimum: 0, maximum: 10000 }, snapshot: { type: 'string', maxLength: 64 } }), required: ['path'] };
const tool = (name, description, inputSchema) => ({ name, title: name, description, inputSchema, annotations: { readOnlyHint: true, untrustedContentHint: true } });
export const manifest = { version: VERSION, tools: [
  tool('evander_find_pages', 'Find fictional public pages by matching their text. Read a result before answering factual questions.', object({ query: { type: 'string', maxLength: 200 }, offset: { type: 'integer', minimum: 0, maximum: 10000 } })),
  tool('evander_read_page', 'Read exact public passages with real section anchors. Follow next when the requested evidence is missing.', pageSchema),
  tool('evander_get_current_page', 'Read the current public page. The browser supplies its actual path.', pageSchema),
  tool('example_opening_hours', 'Read fictional library opening hours and verified directory links. This is a demonstration, not a real service.', object({})),
] };
export function execute({ name, arguments: args }, origin) {
  const descriptor = manifest.tools.find(t => t.name === name);
  if (!descriptor || !args || typeof args !== 'object' || Array.isArray(args) || Object.keys(args).some(key => !(key in descriptor.inputSchema.properties))) throw new Error('invalid_input');
  if (args.query !== undefined && (typeof args.query !== 'string' || args.query.length > 200)) throw new Error('invalid_query');
  if (args.offset !== undefined && (!Number.isInteger(args.offset) || args.offset < 0 || args.offset > 10000)) throw new Error('invalid_offset');
  if (args.snapshot !== undefined && (typeof args.snapshot !== 'string' || args.snapshot.length > 64)) throw new Error('invalid_snapshot');
  const wrap = result => ({ version: VERSION, result });
  if (name === 'example_opening_hours') return wrap({ status: 'ok', coverage: 'complete', fictional: true, items: pages[2].sections.map(section => ({ id: section.id, label: section.heading, facts: [{ label: 'Demo opening hours', value: section.text }], links: [{ label: `${section.heading} — fictional directory`, url: origin + '/directory#' + section.id }] })) });
  if (name === 'evander_find_pages') {
    const matches = pages.filter(page => JSON.stringify(page).toLowerCase().includes((args.query ?? '').toLowerCase())), offset = args.offset ?? 0;
    return wrap({ status: 'ok', mode: 'curated', coverage: 'complete', results: matches.slice(offset, offset + 2).map(page => ({ label: page.title, path: page.path, url: origin + page.path })), nextOffset: offset + 2 < matches.length ? offset + 2 : null });
  }
  if (!validPath(args.path)) throw new Error('invalid_path');
  const page = pages.find(page => page.path === args.path);
  if (!page) return wrap({ status: 'unavailable', coverage: 'unavailable', reason: 'No curated public page for this path.', chunks: [], links: [] });
  const snapshot = createHash('sha256').update(JSON.stringify(page)).digest('hex'), offset = args.offset ?? 0;
  if (offset && !args.snapshot) throw new Error('snapshot_required');
  if (offset && snapshot !== args.snapshot) return wrap({ status: 'stale', reason: 'Content changed. Read again from offset zero.' });
  const next = offset + 2 < page.sections.length ? { path: page.path, offset: offset + 2, snapshot } : null;
  return wrap({ status: 'ok', page: { title: page.title, path: page.path, url: origin + page.path }, snapshot, coverage: next ? 'partial' : 'complete', omissions: [], chunks: page.sections.slice(offset, offset + 2).map(section => ({ id: section.id, heading: section.heading, parents: [], text: section.text, anchor: '#' + section.id })), links: pages.map(p => ({ label: p.title, url: origin + p.path })), next });
}
