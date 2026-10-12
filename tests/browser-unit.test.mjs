import test from 'node:test';
import assert from 'node:assert/strict';
import { Window } from 'happy-dom';
const win = new Window({ url: 'https://fixture.example/' });
for (const key of ['document', 'HTMLElement', 'customElements', 'sessionStorage', 'location']) globalThis[key] = win[key];
globalThis.window = win; globalThis.addEventListener = win.addEventListener.bind(win);
const { registerTools, safeNavigation } = await import('@evander-webmcp/browser');
await import('@evander-webmcp/widget');
test('Bridge does nothing on unsupported browsers', async () => {
  assert.equal(await registerTools({}, null), null);
});
test('Navigation requires an exact verified same-origin destination', () => {
  const verified = new Set(['https://fixture.example/history', 'https://other.example/']);
  assert.equal(safeNavigation('/history', win.location.href, verified), 'https://fixture.example/history');
  assert.equal(safeNavigation('https://other.example/', win.location.href, verified), null);
  assert.equal(safeNavigation('/invented', win.location.href, verified), null);
});
test('Bridge proxies current-page calls with the actual browser path', async () => {
  const registrations = []; const requests = [];
  globalThis.fetch = async (url, options) => {
    requests.push(options);
    return Response.json(options?.method ? { result: { status: 'ok' } } : { tools: [{ name: 'evander_get_current_page', description: 'Read', inputSchema: { type: 'object' } }] });
  };
  const controller = await registerTools({ manifestUrl: '/tools', callUrl: '/call' }, { registerTool: tool => registrations.push(tool) });
  assert.deepEqual(registrations.map(t => t.name), ['evander_get_current_page', 'evander_navigate']);
  await registrations[0].execute({ path: '/forged' });
  assert.equal(JSON.parse(requests[1].body).arguments.path, '/');
  assert.equal(requests[1].credentials, 'omit'); controller.abort();
});
test('Widget maintains input focus, plain-text live response and retained links', async () => {
  const widget = document.createElement('evander-assistant'); widget.setAttribute('endpoint', 'https://backend.example'); widget.setAttribute('site-id', 'fixture'); document.body.append(widget);
  widget.querySelector('.evander-open').click(); assert.equal(document.activeElement, widget.input);
  globalThis.fetch = async () => Response.json({ answer: '<script>not HTML</script>', session: 'opaque', links: [{ label: 'History', url: 'https://fixture.example/history' }] });
  await widget.ask('History?'); assert.equal(document.activeElement, widget.input);
  assert.equal(widget.response.querySelector('script'), null); assert.equal(widget.response.textContent, '<script>not HTML</script>');
  assert.equal(widget.response.getAttribute('aria-live'), 'polite');
  assert.equal(widget.opener.getAttribute('aria-controls'), widget.panel.id);
  widget.querySelector('.evander-close').click(); widget.querySelector('.evander-open').click(); assert.equal(widget.links.querySelectorAll('a').length, 1);
  widget.querySelector('.evander-clear').click(); assert.equal(widget.token, null); assert.equal(widget.links.childElementCount, 0); widget.remove();
});
test('Clearing an old request cannot re-enable controls during a new request', async () => {
  const widget = document.createElement('evander-assistant'); widget.setAttribute('endpoint', 'https://backend.example'); widget.setAttribute('site-id', 'race'); document.body.append(widget);
  const resolvers = []; globalThis.fetch = () => new Promise(resolve => resolvers.push(resolve));
  const old = widget.ask('Old'); widget.querySelector('.evander-clear').click(); const current = widget.ask('New');
  resolvers[0](Response.json({ answer: 'Old', links: [] })); await old;
  assert.equal(widget.querySelector('[type=submit]').disabled, true);
  resolvers[1](Response.json({ answer: 'New', links: [], session: 'new' })); await current;
  assert.equal(widget.response.textContent, 'New'); assert.equal(widget.querySelector('[type=submit]').disabled, false); widget.remove();
});
test('Unavailable backend preserves navigation links and recovers controls without exposing errors', async () => {
  const widget = document.createElement('evander-assistant'); widget.setAttribute('endpoint', 'https://backend.example'); widget.setAttribute('site-id', 'unavailable'); document.body.append(widget);
  globalThis.fetch = async () => Response.json({ answer: 'First answer', session: 'synthetic', links: [{ label: 'History', url: 'https://fixture.example/history' }] });
  await widget.ask('Read history');
  for (const failure of [async () => new Response('private backend details', { status: 503 }), async () => { throw new Error('private network details'); }]) {
    globalThis.fetch = failure; await widget.ask('Try again');
    assert.match(widget.response.textContent, /assistant is unavailable/);
    assert.ok(!widget.response.textContent.includes('private'));
    assert.equal(document.activeElement, widget.input);
    assert.equal(widget.querySelector('[type=submit]').disabled, false);
    assert.equal(widget.querySelector('.evander-cancel').hidden, true);
    assert.equal(widget.links.querySelector('a').href, 'https://fixture.example/history');
  }
  widget.remove();
});
test('Reasoning exhaustion has distinct safe wording and retains prior session, links and focus', async () => {
  const widget = document.createElement('evander-assistant'); widget.setAttribute('endpoint', 'https://backend.example'); widget.setAttribute('site-id', 'limited'); document.body.append(widget);
  globalThis.fetch = async () => Response.json({ answer: 'First answer', session: 'synthetic', links: [{ label: 'History', url: 'https://fixture.example/history' }] });
  await widget.ask('Read history');
  globalThis.fetch = async () => Response.json({ error: 'reasoning_limit', detail: 'private diagnostics must not render' }, { status: 422 });
  await widget.ask('Follow-up');
  assert.match(widget.response.textContent, /within the request limit/); assert.doesNotMatch(widget.response.textContent, /unavailable|private/);
  assert.equal(widget.token, 'synthetic'); assert.equal(widget.links.querySelector('a').href, 'https://fixture.example/history');
  assert.equal(document.activeElement, widget.input); assert.equal(widget.querySelector('[type=submit]').disabled, false);
  widget.remove();
});
