// Scan the actual publishable file set, including untracked initial-release files.
// Ignored local evidence stays private; accidentally force-added files still fail.
import { execFileSync } from 'node:child_process';
import { lstat, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const files = [...new Set(execFileSync('git', [
  'ls-files', '-z', '--cached', '--others', '--exclude-standard',
], { cwd: root, encoding: 'utf8' }).split('\0').filter(Boolean))];
const failures = [];
const prohibited = /(?:^|\/)(?:\.local|\.firecrawl|node_modules|vendor|dist|coverage|test-results|playwright-report)(?:\/|$)|(?:^|\/)\.env(?:\.|$)|\.(?:pem|key|p12|pfx|gpg|log)$/i;
const sensitive = /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|\b(?:AKIA|ASIA)[0-9A-Z]{16}\b|\bsk-or-v1-[a-zA-Z0-9]{20,}|\bgh[pousr]_[a-zA-Z0-9]{30,}|\bgithub_pat_[a-zA-Z0-9_]{30,}|arn:aws[^\s]*:\d{12}:|\/(?:Users|home)\/[^/\s]+\//;
for (const name of files) {
  if (prohibited.test(name) && !/(?:^|\/)\.env\.example$/.test(name)) {
    failures.push(`${name}: local/private/generated file`);
    continue;
  }
  const path = resolve(root, name);
  const stat = await lstat(path);
  if (!stat.isFile() || stat.isSymbolicLink()) {
    failures.push(`${name}: not a regular source file`);
    continue;
  }
  const content = await readFile(path, 'utf8');
  if (sensitive.test(content)) failures.push(`${name}: credential-like or deployment-specific content (value suppressed)`);
}
if (failures.length) throw new Error(failures.join('\n'));
console.log(`Repository audit passed: ${files.length} publishable files. Pattern scanning does not replace manual privacy, provenance or security review.`);
