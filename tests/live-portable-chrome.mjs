// Explicitly opt-in: real, billable inference; fictional content only.
// Local Chrome exercises the visible widget. This does not invoke native WebMCP.
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
import { loadEnvFile } from 'node:process';
try { loadEnvFile('.env'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
if (process.env.RUN_LIVE_PORTABLE !== '1' || !process.env.OPENROUTER_API_KEY || !process.env.OPENROUTER_MODEL) throw new Error('Opt in with RUN_LIVE_PORTABLE=1 and configure the local model key and model');
const root = resolve(import.meta.dirname, '..');
const browser = await chromium.launch({ channel: 'chrome' });
async function ready(url, child) {
  for (let i=0;i<100;i++) {
    if (child.exitCode !== null) throw new Error('Example process exited before readiness');
    try { if ((await fetch(url, { signal: AbortSignal.timeout(1000) })).ok) return; } catch { /* Starting. */ }
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  throw new Error('Example readiness timeout');
}
const cases = [
  { name: 'non-cms-react', directory: 'standalone', port: 5294, mode: 'react', custom: 'List the fictional library opening hours.', expected: /North library/ },
  { name: 'headless-drupal', directory: 'react-drupal', port: 5295, source: 'https://evander-preview10.ddev.site', custom: 'Show the fictional care directory demo.', expected: /fictional|North|South/i },
];
try {
  for (const item of cases) {
    const origin = `http://127.0.0.1:${item.port}`, backend = 'http://127.0.0.1:5296', children = [];
    const env = { ...process.env, DRUPAL_TOOL_BASE: '', TOOL_BASE_URL: item.source || origin, SITE_ORIGIN: origin, SITE_ID: 'portable-live', PORT: '5296', DEV_TLS_CERT: '', DEV_TLS_KEY: '', ROUTE_MAP_FILE: item.source ? resolve(root,'examples/react-drupal/routes.json') : '', VITE_EVANDER_ENDPOINT: backend, VITE_EVANDER_SITE_ID: 'portable-live' };
    // Remove the legacy alias, including inherited local settings, explicitly.
    delete env.DRUPAL_TOOL_BASE;
    let page;
    try {
      const frontend = spawn(process.execPath, [resolve(root,'node_modules/vite/bin/vite.js'),'--host','127.0.0.1','--port',String(item.port),'--strictPort',...(item.mode ? ['--mode',item.mode] : [])], { cwd: resolve(root,'examples',item.directory), env, stdio: 'ignore' }); children.push(frontend);
      await ready(origin, frontend);
      const service = spawn(process.execPath, [resolve(root,'services/reference-backend/server.mjs')], { cwd: root, env, stdio: ['ignore','pipe','inherit'] }); children.push(service);
      service.stdout.on('data', bytes => process.stdout.write(bytes));
      await ready(backend + '/healthz', service);
      page = await browser.newPage(); await page.goto(origin);
      await page.getByRole('button',{name:'Open site assistant'}).click();
      for (const [message, expected] of [['Read the current page.',/library|community/i],['What happened in 2010?',/2010/],[item.custom,item.expected]]) {
        const input = page.getByRole('textbox',{name:'Ask about this site'});
        await input.fill(message); await input.press('Enter');
        await page.waitForFunction(() => { const value=document.querySelector('.evander-response')?.textContent; return value && value !== 'Working on it…'; }, null, {timeout:95000});
        const answer = await page.locator('.evander-response').innerText();
        const links = await page.locator('.evander-links a').evaluateAll(links => links.map(a=>({label:a.textContent,url:a.href})));
        console.log(JSON.stringify({example:item.name,prompt:message,answer,links}));
        assert.match(answer,expected); assert.ok(links.length); assert.equal(await input.evaluate(element=>element===document.activeElement),true);
        if (message.includes('2010')) {
          const target=page.locator('.evander-links a').first();
          assert.ok((await target.getAttribute('href')).startsWith(origin+'/'));
          await target.click();
          await page.waitForFunction(()=>document.activeElement?.hasAttribute('data-evander-section'));
        }
      }
    } finally {
      await page?.close();
      for (const child of children.reverse()) { if (child.exitCode===null) { child.kill('SIGTERM'); await once(child,'exit'); } }
    }
  }
  console.log('Live Chrome: six grounded turns passed across non-CMS React and headless Drupal.');
} finally { await browser.close(); }
