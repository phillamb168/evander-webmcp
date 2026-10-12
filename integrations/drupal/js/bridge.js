/** Drupal-hosted, model-free WebMCP bridge. No backend or chat dependency. */
export function safeNavigation(value, current, verified) {
  try {
    const url = new URL(value, current);
    return url.origin === new URL(current).origin && verified.has(url.href) ? url.href : null;
  } catch { return null; }
}

export async function registerTools(settings, context = document.modelContext) {
  if (!context?.registerTool) return null;
  const controller = new AbortController();
  const verified = new Set([...document.querySelectorAll('a[href]')].map(a => a.href));
  for (const section of document.querySelectorAll('[data-evander-section][id], [data-evander-section] :is(h1,h2,h3,h4,h5,h6)[id]')) verified.add(new URL(`#${encodeURIComponent(section.id)}`, location.href).href);
  const response = await fetch(settings.manifestUrl, { signal: controller.signal, credentials: 'omit' });
  if (!response.ok) throw new Error('Tool discovery unavailable');
  const manifest = await response.json();
  for (const descriptor of manifest.tools) {
    await context.registerTool({
      ...descriptor,
      execute: async (args, options) => {
        const arguments_ = descriptor.name === 'evander_get_current_page' ? { ...args, path: location.pathname } : args;
        const result = await fetch(settings.callUrl, {
          method: 'POST', credentials: 'omit', signal: options?.signal ?? controller.signal,
          headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: descriptor.name, arguments: arguments_ }),
        });
        if (!result.ok) throw new Error(`Tool request failed (${result.status})`);
        const envelope = await result.json();
        for (const link of [...(envelope.result.results ?? []), ...(envelope.result.links ?? []), ...(envelope.result.page ? [envelope.result.page] : [])]) {
          if (link.url) { try { const u = new URL(link.url, location.href); if (u.origin === location.origin) verified.add(u.href); } catch { /* Ignore invalid links. */ } }
        }
        for (const chunk of envelope.result.chunks ?? []) {
          if (chunk.anchor && envelope.result.page?.url) {
            const u = new URL(envelope.result.page.url + chunk.anchor, location.href);
            if (u.origin === location.origin) verified.add(u.href);
          }
        }
        return envelope.result;
      },
    }, { signal: controller.signal });
  }
  await context.registerTool({
    name: 'evander_navigate', title: 'Go to a verified page',
    description: 'Navigate this browser tab to an exact same-origin URL returned by a site tool or present in page links. This changes the browser page, not site data. Only use when the user asks to go there.',
    inputSchema: { type: 'object', properties: { url: { type: 'string' } }, required: ['url'], additionalProperties: false },
    annotations: { readOnlyHint: false, untrustedContentHint: false, consequentialHint: false },
    execute: async ({ url }) => {
      const target = safeNavigation(url, location.href, verified);
      if (!target) throw new Error('Unverified navigation');
      const parsed = new URL(target);
      if (parsed.pathname === location.pathname && parsed.hash) {
        const section = document.getElementById(decodeURIComponent(parsed.hash.slice(1)));
        if (!section) throw new Error('Section is no longer available');
        section.tabIndex = -1; section.focus({ preventScroll: true }); section.scrollIntoView({ block: 'start' });
        return { status: 'section_focused', url: target };
      }
      setTimeout(() => location.assign(target), 0);
      return { status: 'navigation_scheduled', url: target };
    },
  }, { signal: controller.signal });
  addEventListener('pagehide', () => controller.abort(), { once: true });
  return controller;
}

if (typeof window !== 'undefined' && window.Drupal) {
  Drupal.behaviors.evanderSectionFocus = { attach() {
    if (!location.hash || document.documentElement.dataset.evanderFocusedHash === location.hash) return;
    let target;
    try { target = document.getElementById(decodeURIComponent(location.hash.slice(1))); } catch { return; }
    if (!target?.closest('[data-evander-section]')) return;
    document.documentElement.dataset.evanderFocusedHash = location.hash;
    target.tabIndex = -1; target.focus({ preventScroll: true }); target.scrollIntoView({ block: 'start' });
  } };
  Drupal.behaviors.evanderWebmcp = { attach() {
    if (document.documentElement.dataset.evanderRegistered || !document.modelContext) return;
    document.documentElement.dataset.evanderRegistered = 'true';
    registerTools(drupalSettings.evanderWebmcp).then(() => { document.documentElement.dataset.evanderRegistered = 'ready'; }).catch(() => { delete document.documentElement.dataset.evanderRegistered; });
  } };
}
