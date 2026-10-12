// Local, offline verification. No deployment, real model calls or site mutation.
import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
const root = resolve(import.meta.dirname, '..');
const run = (command, args) => {
  const result = spawnSync(command, args, { cwd: root, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
};
run(process.execPath, ['--test', ...readdirSync(resolve(root, 'tests')).filter(name => name.endsWith('.test.mjs')).sort().map(name => `tests/${name}`)]);
run('php', ['tests/php/run.php']);
run(process.execPath, ['scripts/audit-repository.mjs']);
run(process.execPath, ['scripts/package.mjs']);
run(process.execPath, ['scripts/audit-package.mjs']);
run(process.execPath, ['scripts/test-packages.mjs']);
console.log('Local verification passed. Live Drupal/browser/model tests and ongoing human screen-reader validation are separate.');
