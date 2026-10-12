import { build } from 'vite';
import { cp, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(import.meta.dirname, '..');
export async function library(entry, outDir, filename) {
  await build({ configFile: false, root, logLevel: 'warn', build: { emptyOutDir: false, outDir, minify: false,
    lib: { entry: resolve(root, entry), formats: ['es'], fileName: () => filename },
    rollupOptions: { output: { inlineDynamicImports: true } } } });
}
export async function browserAssets() {
  const out = resolve(root, 'dist/browser'); await mkdir(out, { recursive: true });
  await library('packages/browser/index.js', out, 'browser.js');
  await library('packages/widget/index.js', out, 'widget.js');
  await cp(resolve(root, 'packages/widget/widget.css'), resolve(out, 'widget.css'));
}
export async function examples() {
  await build({ root: resolve(root, 'examples/react-drupal') });
  for (const mode of ['production', 'react']) await build({ root: resolve(root, 'examples/standalone'), mode });
}
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) { await browserAssets(); await examples(); }
