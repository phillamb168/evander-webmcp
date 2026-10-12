import { readdir, readFile } from 'node:fs/promises';
import { resolve, relative } from 'node:path';
const root = resolve(import.meta.dirname, '..', 'dist/evander_webmcp');
const failures = []; let files = 0;
async function walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = resolve(dir, entry.name), name = relative(root, path);
    if (entry.isSymbolicLink()) { failures.push(`${name}: symlink`); continue; }
    if (/(?:^|\/)(?:\.env(?:\.|$)|node_modules|vendor|\.local|reference|test-results)/.test(name)) failures.push(`${name}: development or secret file`);
    if (entry.isDirectory()) { await walk(path); continue; }
    files++; const content = await readFile(path, 'utf8');
    if (/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|\b(?:AKIA|ASIA)[0-9A-Z]{16}\b|\bsk-or-v1-[a-zA-Z0-9]{20,}|arn:aws[^\s]*:\d{12}:|\/(?:Users|home)\/[^/\s]+\//.test(content)) failures.push(`${name}: deployment-specific or credential-like content (value suppressed)`);
  }
}
await walk(root);
if (failures.length) throw new Error(failures.join('\n'));
console.log(`Package audit passed: ${files} files; no detected private adapters, credentials, local paths or development dependencies. Manual review is still required.`);
