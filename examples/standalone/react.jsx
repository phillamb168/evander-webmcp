import React, { useMemo, useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { EvanderAssistant, useWebMCP } from '@evander-webmcp/react';
import { focusSection } from '@evander-webmcp/browser';
import '@evander-webmcp/widget/widget.css';
import pages from './content.json';
function App() {
  const [path, setPath] = useState(location.pathname);
  const options = useMemo(() => ({ manifestUrl: '/evander-webmcp/v1/tools', callUrl: '/evander-webmcp/v1/call', navigate(url) { history.pushState({}, '', url); setPath(location.pathname); } }), []);
  useWebMCP(options, path);
  useEffect(() => { const onPop = () => setPath(location.pathname); addEventListener('popstate', onPop); return () => removeEventListener('popstate', onPop); }, []);
  useEffect(() => { if (location.hash) focusSection(location.hash); }, [path]);
  const page = pages.find(page => page.path === path);
  return <>{import.meta.env.VITE_EVANDER_ENDPOINT && <EvanderAssistant endpoint={import.meta.env.VITE_EVANDER_ENDPOINT} siteId={import.meta.env.VITE_EVANDER_SITE_ID || 'standalone-demo'} integration={options} routeKey={path} />}
    <main><nav>{pages.map(p => <a key={p.path} href={p.path} onClick={event => { if (!event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) { event.preventDefault(); options.navigate(p.path); } }}>{p.title} | </a>)}</nav>
    <h1>{page?.title ?? 'Page not found'}</h1>{page?.sections.map(item => <section key={item.id} id={item.id} data-evander-section=""><h2>{item.heading}</h2><p>{item.text}</p></section>)}</main></>;
}
createRoot(document.getElementById('root')).render(<React.StrictMode><App /></React.StrictMode>);
