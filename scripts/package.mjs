import { cp, mkdir, readdir, rename } from 'node:fs/promises';
import { resolve } from 'node:path';
import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { browserAssets, library } from './build.mjs';
const root = resolve(import.meta.dirname, '..');
const drupal = resolve(root, 'integrations/drupal');
const target = resolve(root, 'dist/evander_webmcp');
async function freshDirectory(path) {
  try { await rename(path, path + `.previous-${Date.now()}`); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  await mkdir(path, { recursive: true });
}
// Preserve the previous generated artifact outside the new install directory;
// stale files must never survive into a release after a source file is removed.
try { await rename(target, resolve(root, `dist/previous-${Date.now()}`)); } catch (error) { if (error.code !== 'ENOENT') throw error; }
await mkdir(target, { recursive: true });
const version = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8')).version;
const files = ['composer.json', 'config', 'src', 'modules'];
for (const name of await readdir(drupal)) if (name.startsWith('evander_webmcp.')) files.push(name);
for (const name of files) await cp(resolve(drupal, name), resolve(target, name), { recursive: true });
for (const name of ['LICENSE', 'SECURITY.md']) await cp(resolve(root, name), resolve(target, name));
await writeFile(resolve(target, 'README.md'), (await readFile(resolve(drupal, 'README.md'), 'utf8')).replaceAll('../../docs/', 'docs/'));
await library('integrations/drupal/js/bridge.js', resolve(target, 'js'), 'bridge.js');
await library('integrations/drupal/js/widget.js', resolve(target, 'js'), 'widget.js');
await mkdir(resolve(target, 'css'), { recursive: true });
await cp(resolve(root, 'packages/widget/widget.css'), resolve(target, 'css/widget.css'));
await mkdir(resolve(target, 'docs'), { recursive: true });
for (const name of ['developer-guide.md', 'local-testing.md', `release-notes-${version}.md`]) await cp(resolve(root, 'docs', name), resolve(target, 'docs', name));
await freshDirectory(resolve(root, 'dist/browser'));
await browserAssets();
await mkdir(resolve(root, 'dist/npm'), { recursive: true });
for (const name of ['contracts', 'browser', 'widget', 'react']) {
  const source = resolve(root, 'packages', name), stage = resolve(root, 'dist/npm-stage', name);
  await freshDirectory(stage);
  const manifest = JSON.parse(await readFile(resolve(source, 'package.json'), 'utf8'));
  for (const file of ['package.json', ...manifest.files.filter(file => file !== 'LICENSE')]) await cp(resolve(source, file), resolve(stage, file));
  await cp(resolve(root, 'LICENSE'), resolve(stage, 'LICENSE'));
  execFileSync('npm', ['pack', '--ignore-scripts', '--json', '--pack-destination', resolve(root, 'dist/npm')], { cwd: stage });
}
const artifacts = [`evander_webmcp-${version}.tar.gz`, `evander-browser-${version}.tar.gz`];
for (const [i, dir] of ['evander_webmcp', 'browser'].entries()) execFileSync('tar', ['-czf', resolve(root, 'dist', artifacts[i]), '-C', resolve(root, 'dist'), dir], { env: { ...process.env, COPYFILE_DISABLE: '1' } });
for (const file of (await readdir(resolve(root, 'dist/npm'))).filter(file => file.endsWith(`-${version}.tgz`))) artifacts.push('npm/' + file);
const checksums = [];
for (const file of artifacts) checksums.push(`${createHash('sha256').update(await readFile(resolve(root, 'dist', file))).digest('hex')}  ${file}`);
await writeFile(resolve(root, 'dist/SHA256SUMS'), checksums.join('\n') + '\n');
console.log(`Installable module: ${target} (no reference backend, secrets, fixtures or npm dependencies)`);
