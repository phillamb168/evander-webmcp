import { boundedJson, publicUrl, validateManifest, validateEnvelope } from '@evander-webmcp/contracts';

const active = new WeakMap();
export function safeNavigation(value, current, verified) {
  const safe = publicUrl(value, current);
  return safe && new URL(safe).origin === new URL(current).origin && verified.has(safe) ? safe : null;
}

export function focusSection(hash, document_ = globalThis.document) {
  let id; try { id = decodeURIComponent(hash.replace(/^#/, '')); } catch { return false; }
  const section = document_?.getElementById(id);
  if (!section) return false;
  section.tabIndex = -1; section.focus({ preventScroll: true }); section.scrollIntoView?.({ block: 'start' });
  return true;
}

/** Explicit browser initialization. No Drupal, React or inference dependency. */
export async function registerTools(settings, context = globalThis.document?.modelContext) {
  if (!context?.registerTool) return null;
  if (active.has(context)) throw new Error('Evander tools are already registered in this context');
  const controller = new AbortController(); active.set(context, controller);
  const verified = new Map(); let generation = 0;
  const add = value => {
    const source = publicUrl(value, location.href); if (!source) return;
    const mapped = settings.mapSourceUrl ? publicUrl(settings.mapSourceUrl(source), location.href) : source;
    if (mapped && new URL(mapped).origin === location.origin) { verified.set(source, mapped); verified.set(mapped, mapped); }
  };
  controller.refresh = () => {
    generation++;
    verified.clear();
    for (const a of document.querySelectorAll('a[href]')) add(a.href);
    for (const section of document.querySelectorAll('[data-evander-section][id], [data-evander-section] :is(h1,h2,h3,h4,h5,h6)[id]')) add(new URL(`#${encodeURIComponent(section.id)}`, location.href).href);
  };
  const onAbort = () => controller.abort();
  settings.signal?.addEventListener('abort', onAbort, { once: true });
  const onPageHide = () => controller.abort();
  controller.signal.addEventListener('abort', () => {
    if (active.get(context) === controller) active.delete(context);
    settings.signal?.removeEventListener('abort', onAbort);
    globalThis.removeEventListener?.('pagehide', onPageHide);
    verified.clear();
  }, { once: true });
  try {
    if (settings.signal?.aborted) controller.abort();
    controller.signal.throwIfAborted(); controller.refresh();
    const manifest = validateManifest(await boundedJson(await fetch(settings.manifestUrl, { signal: controller.signal, credentials: 'omit', redirect: 'error' })));
    for (const descriptor of manifest.tools) {
      controller.signal.throwIfAborted();
      await context.registerTool({ ...descriptor, execute: async (args, options) => {
        controller.signal.throwIfAborted();
        const startedPath = location.pathname, startedGeneration = generation;
        const signal = options?.signal ? AbortSignal.any([controller.signal, options.signal]) : controller.signal;
        const path = settings.resolveCurrentPath ? settings.resolveCurrentPath(startedPath) : startedPath;
        if (descriptor.name === 'evander_get_current_page' && path === null) return { status: 'unavailable', coverage: 'unavailable', reason: 'The current frontend route has no configured content mapping.' };
        const arguments_ = descriptor.name === 'evander_get_current_page' ? { ...args, path } : args;
        const response = await fetch(settings.callUrl, { method: 'POST', credentials: 'omit', redirect: 'error', signal, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: descriptor.name, arguments: arguments_ }) });
        const { result } = validateEnvelope(await boundedJson(response));
        signal.throwIfAborted();
        if (startedPath !== location.pathname || startedGeneration !== generation) throw new Error('Page changed during tool execution; retry on the current page');
        for (const link of [...(result.results ?? []), ...(result.links ?? []), ...(result.page ? [result.page] : []), ...(result.items ?? []).flatMap(item => item.links ?? [])]) if (link.url) add(link.url);
        for (const chunk of result.chunks ?? []) if (chunk.anchor && result.page?.url) add(result.page.url + chunk.anchor);
        return result;
      } }, { signal: controller.signal });
    }
    controller.signal.throwIfAborted();
    await context.registerTool({
      name: 'evander_navigate', title: 'Go to a verified page',
      description: 'Navigate this browser tab to an exact verified link from site tools or the current page. Configured headless routes map canonical source URLs to this frontend. Unmapped external destinations are not navigable. This changes the browser page, not site data. Only use when the user asks to go there.',
      inputSchema: { type: 'object', properties: { url: { type: 'string' } }, required: ['url'], additionalProperties: false },
      annotations: { readOnlyHint: false, untrustedContentHint: false, consequentialHint: false },
      execute: async ({ url }) => {
        controller.signal.throwIfAborted();
        const source = publicUrl(url, location.href), target = source && verified.get(source);
        if (!target || new URL(target).origin !== location.origin) throw new Error('Unverified navigation');
        const parsed = new URL(target);
        if (parsed.pathname === location.pathname && parsed.hash) {
          if (!focusSection(parsed.hash)) throw new Error('Section is no longer available');
          return { status: 'section_focused', url: target };
        }
        if (settings.navigate) await settings.navigate(target);
        else setTimeout(() => { if (!controller.signal.aborted) location.assign(target); }, 0);
        return { status: 'navigation_scheduled', url: target };
      },
    }, { signal: controller.signal });
    globalThis.addEventListener?.('pagehide', onPageHide, { once: true });
    return controller;
  } catch (error) { controller.abort(); throw error; }
}
