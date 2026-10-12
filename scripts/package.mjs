import { cp, mkdir, readdir, rename } from 'node:fs/promises';
import { resolve } from 'node:path';
const root = resolve(import.meta.dirname, '..');
const drupal = resolve(root, 'integrations/drupal');
const target = resolve(root, 'dist/evander_webmcp');
// Preserve the previous generated artifact outside the new install directory;
// stale files must never survive into a release after a source file is removed.
try { await rename(target, resolve(root, `dist/previous-${Date.now()}`)); } catch (error) { if (error.code !== 'ENOENT') throw error; }
await mkdir(target, { recursive: true });
const files = ['composer.json', 'config', 'css', 'js', 'src', 'modules'];
for (const name of await readdir(drupal)) if (name.startsWith('evander_webmcp.')) files.push(name);
for (const name of files) await cp(resolve(drupal, name), resolve(target, name), { recursive: true });
for (const name of ['README.md', 'LICENSE', 'SECURITY.md']) await cp(resolve(root, name), resolve(target, name));
await mkdir(resolve(target, 'docs'), { recursive: true });
for (const name of ['developer-guide.md', 'local-testing.md', 'release-notes-0.1.0-alpha.1.md']) await cp(resolve(root, 'docs', name), resolve(target, 'docs', name));
console.log(`Installable module: ${target} (no reference backend, secrets, fixtures or npm dependencies)`);
