// Install the actual tarballs outside the workspace, with no package symlinks.
import { mkdtempSync, writeFileSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
const root = resolve(import.meta.dirname, '..'), consumer = mkdtempSync(join(tmpdir(), 'evander-package-consumer-'));
const version = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version;
writeFileSync(join(consumer, 'package.json'), JSON.stringify({ private: true, type: 'module' }));
const archives = readdirSync(join(root, 'dist/npm')).filter(file => file.endsWith(`-${version}.tgz`)).map(file => join(root, 'dist/npm', file));
for (const archive of archives) {
  const paths = execFileSync('tar', ['-tzf', archive], { encoding: 'utf8' }).trim().split('\n');
  if (paths.some(path => !path.startsWith('package/') || /(?:^|\/)(?:\.env|node_modules|\.local|\.firecrawl|reference)(?:\/|$)/.test(path) || path.split('/').includes('..'))) throw new Error('Unsafe package content');
}
// npm ci caches package archives, but not necessarily registry metadata. Pack
// the installed, lockfile-verified React runtime closure so this consumer test
// needs neither a registry nor a pre-warmed developer-machine metadata cache.
const require = createRequire(import.meta.url), visited = new Set(), runtime = [];
function packRuntime(name, from = require) {
  const file = from.resolve(name + '/package.json'); if (visited.has(file)) return;
  visited.add(file); const manifest = JSON.parse(readFileSync(file, 'utf8'));
  for (const dependency of Object.keys(manifest.dependencies ?? {})) packRuntime(dependency, createRequire(file));
  const packed = JSON.parse(execFileSync('npm', ['pack', '--ignore-scripts', '--json', '--pack-destination', consumer], { cwd: dirname(file), encoding: 'utf8' }));
  runtime.push(join(consumer, packed[0].filename));
}
packRuntime('react'); packRuntime('react-dom');
execFileSync('npm', ['install', '--offline', '--cache', join(consumer, 'empty-cache'), '--ignore-scripts', '--no-audit', '--no-fund', '--no-package-lock', ...archives, ...runtime], { cwd: consumer, stdio: 'pipe' });
execFileSync(process.execPath, ['--input-type=module', '-e', `
import assert from 'node:assert/strict';
import React from 'react'; import {renderToString} from 'react-dom/server';
import {EvanderAssistant} from '@evander-webmcp/react';
import {registerTools} from '@evander-webmcp/browser';
import {defineAssistant} from '@evander-webmcp/widget';
import {VERSION} from '@evander-webmcp/contracts';
assert.equal(VERSION,'1.0'); assert.equal(defineAssistant(),null);
assert.equal(await registerTools({}),null);
assert.match(renderToString(React.createElement(EvanderAssistant,{endpoint:'https://backend.example',siteId:'demo'})),/evander-assistant/);
`], { cwd: consumer, stdio: 'inherit' });
console.log('Packed JavaScript consumer passed: standalone install, all imports, SSR and unsupported-browser fallback.');
