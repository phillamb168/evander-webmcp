import React, { useState, useEffect, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { EvanderAssistant, useWebMCP } from '@evander-webmcp/react';
import { createRouteMap, boundedJson, validateEnvelope } from '@evander-webmcp/contracts';
import { focusSection } from '@evander-webmcp/browser';
import '@evander-webmcp/widget/widget.css';
import routes from './routes.json';
const routeMap = createRouteMap({ sourceOrigin: __SOURCE_ORIGIN__, publicOrigin: location.origin, routes });
function App() {
  const [path, setPath] = useState(location.pathname), [page, setPage] = useState(null), [error, setError] = useState('');
  const integration = useMemo(() => ({ ...routeMap, manifestUrl: '/evander-webmcp/v1/tools', callUrl: '/evander-webmcp/v1/call', navigate(url) { history.pushState({}, '', url); setPath(location.pathname); } }), []);
  useWebMCP(integration, path);
  useEffect(() => { const onPop = () => setPath(location.pathname); addEventListener('popstate', onPop); return () => removeEventListener('popstate', onPop); }, []);
  useEffect(() => {
    const abort = new AbortController(); setPage(null); setError('');
    const sourcePath = routeMap.resolveCurrentPath(path);
    if (!sourcePath) { setError('This route has no configured public content.'); return () => abort.abort(); }
    (async () => {
      let next = { path: sourcePath }, result, chunks = [], bytes = 0;
      // Example rendering is bounded, even if an upstream continuation is broken.
      for (let step = 0; next && step < 20; step++) {
        const data = await boundedJson(await fetch('/evander-webmcp/v1/call', { method: 'POST', credentials: 'omit', signal: abort.signal, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'evander_read_page', arguments: next }) }));
        result = validateEnvelope(data).result;
        if (result.status !== 'ok') throw new Error('Public content unavailable');
        bytes += new TextEncoder().encode(JSON.stringify(result)).length; if (bytes > 2000000) throw new Error('Example render limit');
        chunks.push(...result.chunks); next = result.next;
      }
      if (next) throw new Error('Example render limit');
      if (!abort.signal.aborted) setPage({ ...result, chunks });
    })().catch(() => { if (!abort.signal.aborted) setError('Public content could not be loaded.'); });
    return () => abort.abort();
  }, [path]);
  useEffect(() => { if (page && location.hash) focusSection(location.hash); }, [page]);
  const groups = new Map();
  for (const chunk of page?.chunks ?? []) { const key = chunk.anchor || chunk.id; if (!groups.has(key)) groups.set(key, []); groups.get(key).push(chunk); }
  return <>{import.meta.env.VITE_EVANDER_ENDPOINT && <EvanderAssistant endpoint={import.meta.env.VITE_EVANDER_ENDPOINT} siteId={import.meta.env.VITE_EVANDER_SITE_ID || 'react-drupal-demo'} integration={integration} routeKey={path} />}
    <main><nav>{routes.map(route => <a key={route.path} href={route.path} onClick={event => { if (!event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) { event.preventDefault(); integration.navigate(route.path); } }}>{route.path === '/' ? 'Home' : 'Timeline'} | </a>)}</nav>
    <h1>{page?.page.title || 'Evander headless Drupal example'}</h1><p>Public Drupal passages rendered in React. Partial coverage means other source content may exist.</p>
    <p role="status">{error || (page ? '' : 'Loading public content…')}</p>
    {[...groups].map(([id, chunks]) => <section key={id} id={id.replace(/^#/, '')} data-evander-section=""><h2>{chunks[0].heading}</h2>{chunks.map(chunk => <p key={chunk.id}>{chunk.text}</p>)}</section>)}
    </main></>;
}
createRoot(document.getElementById('root')).render(<React.StrictMode><App /></React.StrictMode>);
