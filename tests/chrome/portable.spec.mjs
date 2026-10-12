import { test, expect } from '@playwright/test';

// Registration harness, not native external-agent invocation. HTTP tools and
// rendered pages are real; only modelContext and UI error responses are stubs.
async function registrationHarness(page) {
  await page.addInitScript(() => {
    window.testTools = new Map(); window.registrationErrors = [];
    Object.defineProperty(document, 'modelContext', { configurable: true, value: {
      registerTool(tool, { signal }) {
        if (window.testTools.has(tool.name)) { window.registrationErrors.push(tool.name); throw new Error('Duplicate tool'); }
        window.testTools.set(tool.name, tool);
        signal.addEventListener('abort', () => window.testTools.delete(tool.name), { once: true });
      },
    } });
  });
}
async function call(page, name, args = {}) {
  return page.evaluate(async ({ name, args }) => window.testTools.get(name).execute(args), { name, args });
}
async function reply(page, answer, status = 200) {
  await page.route('http://127.0.0.1:5280/v1/agent', route => route.fulfill({ status, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': new URL(page.url()).origin }, body: JSON.stringify(answer) }));
}

for (const [mode, port] of [['plain', 5274], ['react', 5275]]) {
  test(`${mode}: real discovery, continuation, custom tool, navigation and section focus`, async ({ page }) => {
    await registrationHarness(page); await page.goto(`http://127.0.0.1:${port}/`);
    await expect.poll(() => page.evaluate(() => window.testTools.size)).toBe(5);
    const result = await call(page, 'evander_find_pages', { query: 'library' });
    expect(result.results.length).toBeGreaterThan(0);
    const home = await call(page, 'evander_get_current_page', { path: '/invented' });
    expect(home.page.path).toBe('/'); expect(home.chunks[1].text).toContain('2010');
    const first = await call(page, 'evander_read_page', { path: '/history' });
    expect(first.next.offset).toBe(2);
    const second = await call(page, 'evander_read_page', first.next); expect(second.next).toBeNull();
    expect((await call(page, 'example_opening_hours')).items).toHaveLength(2);
    await call(page, 'evander_navigate', { url: first.page.url + '#founding' });
    await expect(page).toHaveURL(/\/history#founding$/);
    await expect(page.locator('h1')).toHaveText('Library timeline');
    await expect(page.locator('#founding')).toBeFocused();
    await expect.poll(() => page.evaluate(() => window.testTools.size)).toBe(5);
    await call(page, 'evander_get_current_page', {});
    await call(page, 'evander_navigate', { url: `http://127.0.0.1:${port}/history#founding` });
    await expect(page.locator('#founding')).toBeFocused();
    await expect(page.locator('#founding')).toHaveAttribute('tabindex', '-1');
    expect(await page.evaluate(() => window.registrationErrors)).toEqual([]);
    if (mode === 'react') {
      await page.goBack(); await expect(page.locator('h1')).toHaveText('Fictional community library');
      await page.goForward(); await expect(page.locator('h1')).toHaveText('Library timeline');
      expect((await call(page, 'evander_get_current_page', {})).page.path).toBe('/history');
      expect(await page.evaluate(() => window.registrationErrors)).toEqual([]);
    }
  });

  test(`${mode}: chat focus, links, clear, close, errors, cancellation and recovery`, async ({ page }) => {
    await page.goto(`http://127.0.0.1:${port}/`);
    const input = page.getByRole('textbox', { name: 'Ask about this site' });
    const status = page.locator('.evander-response');
    await page.getByRole('button', { name: 'Open site assistant' }).click(); await expect(input).toBeFocused();
    await reply(page, { answer: 'The library opened in 2010.', session: 'fixture', links: [{ label: 'Read the history', url: `http://127.0.0.1:${port}/#history` }] });
    await input.fill('What happened in 2010?'); await input.press('Enter');
    await expect(status).toContainText('2010'); await expect(input).toBeFocused();
    await expect(status).toHaveAttribute('aria-live', 'polite');
    await page.getByRole('link', { name: 'Read the history' }).click(); await expect(page.locator('#history')).toBeFocused();
    await page.getByRole('button', { name: 'Clear conversation' }).click(); await expect(status).toHaveText('Conversation cleared.'); await expect(input).toBeFocused();
    await page.getByRole('button', { name: 'Close site assistant' }).click(); await expect(page.getByRole('button', { name: 'Open site assistant' })).toBeFocused();
    await page.getByRole('button', { name: 'Open site assistant' }).click();
    await page.unrouteAll(); await reply(page, { error: 'reasoning_limit' }, 422);
    await input.fill('Exhaust the fixture limit'); await input.press('Enter'); await expect(status).toContainText('request limit');
    await page.unrouteAll(); await reply(page, { error: 'assistant_unavailable' }, 503);
    await input.fill('Unavailable fixture'); await input.press('Enter'); await expect(status).toContainText('assistant is unavailable');
    await page.unrouteAll(); await page.route('http://127.0.0.1:5280/v1/agent', () => {});
    await input.fill('Cancel this request'); await input.press('Enter'); await expect(status).toHaveText('Working on it…');
    await page.getByRole('button', { name: 'Cancel request' }).click(); await expect(status).toHaveText('Request cancelled.'); await expect(input).toBeFocused();
    await page.unrouteAll({ behavior: 'ignoreErrors' }); await reply(page, { answer: 'Recovered.', session: 'fresh', links: [] });
    await input.fill('Retry'); await input.press('Enter'); await expect(status).toHaveText('Recovered.');
  });
}

test('Native-only example works without configuring or contacting inference', async ({ page }) => {
  await registrationHarness(page); const requests = []; page.on('request', request => requests.push(request.url()));
  await page.goto('http://127.0.0.1:5277/'); await expect.poll(() => page.evaluate(() => window.testTools.size)).toBe(5);
  expect((await call(page, 'evander_get_current_page')).chunks.length).toBeGreaterThan(0);
  await expect(page.locator('evander-assistant')).toHaveCount(0);
  expect(requests.some(url => url.includes('/v1/agent'))).toBe(false);
});

test('Headless Drupal maps the current route and renders genuine source anchors', async ({ page }) => {
  test.skip(!process.env.DRUPAL_FIXTURE, 'Opt in with a disposable Drupal fixture');
  await registrationHarness(page); await page.goto('http://127.0.0.1:5276/');
  await expect(page.locator('h1')).toHaveText('Welcome to the developer preview');
  await expect.poll(() => page.evaluate(() => window.testTools.size)).toBe(5);
  const home = await call(page, 'evander_get_current_page', { path: '/invented' }); expect(home.page.path).toBe('/node/1');
  const anchor = home.chunks.find(chunk => chunk.anchor).anchor;
  await call(page, 'evander_navigate', { url: home.page.url + anchor }); await expect(page.locator(anchor)).toBeFocused();
  await reply(page, { answer: 'Verified Drupal source.', session: 'fixture', links: [{ label: 'Mapped source', url: home.page.url + anchor }] });
  await page.getByRole('button', { name: 'Open site assistant' }).click();
  await page.getByRole('textbox').fill('Read the source'); await page.getByRole('textbox').press('Enter');
  await expect(page.getByRole('link', { name: 'Mapped source' })).toHaveAttribute('href', 'http://127.0.0.1:5276/' + anchor);
  await page.locator('nav a[href="/timeline"]').click(); await expect(page.locator('h1')).toHaveText('Community timeline');
  await expect(page.getByText(/END_OF_LONG_COMPONENT/)).toBeVisible();
  expect((await call(page, 'evander_get_current_page', {})).page.path).toBe('/node/2');
  await page.goBack(); await expect(page.locator('h1')).toHaveText('Welcome to the developer preview');
  await page.goForward(); await expect(page.locator('h1')).toHaveText('Community timeline');
  expect(await page.evaluate(() => window.registrationErrors)).toEqual([]);
});

test('Installed Drupal archive registers bundled tools and focuses a real section', async ({ page }) => {
  test.skip(!process.env.DRUPAL_FIXTURE, 'Opt in with a disposable Drupal fixture');
  await registrationHarness(page); await page.goto(process.env.DRUPAL_FIXTURE + '/');
  await expect.poll(() => page.evaluate(() => window.testTools.size)).toBe(5);
  const result = await call(page, 'evander_get_current_page', { path: '/invented' });
  expect(result.page.title).toBe('Welcome to the developer preview');
  const anchor=result.chunks.find(chunk=>chunk.anchor).anchor;
  // The homepage's canonical URL is /node/1; visit that URL before testing
  // same-page focus rather than treating / as a canonical-path alias in the bridge.
  await page.goto(result.page.url); await expect.poll(() => page.evaluate(() => window.testTools.size)).toBe(5);
  await call(page,'evander_get_current_page',{});
  await call(page,'evander_navigate',{url:result.page.url+anchor});
  await expect(page.locator(anchor)).toBeFocused();
  expect(await page.evaluate(() => window.registrationErrors)).toEqual([]);
});
