import { registerTools } from '@evander-webmcp/browser';
import '@evander-webmcp/widget';
import '@evander-webmcp/widget/widget.css';
import pages from './content.json';
const root = document.getElementById('root');
const main = document.createElement('main'), nav = document.createElement('nav');
for (const page of pages) { const link = document.createElement('a'); link.href = page.path; link.textContent = page.title; nav.append(link, document.createTextNode(' | ')); }
main.append(nav);
const page = pages.find(page => page.path === location.pathname);
const heading = document.createElement('h1'); heading.textContent = page?.title ?? 'Page not found'; main.append(heading);
for (const item of page?.sections ?? []) {
  const section = document.createElement('section'); section.dataset.evanderSection = ''; section.id = item.id;
  const h = document.createElement('h2'); h.textContent = item.heading;
  const p = document.createElement('p'); p.textContent = item.text; section.append(h, p); main.append(section);
}
root.append(main);
if (import.meta.env.VITE_EVANDER_ENDPOINT && import.meta.env.VITE_EVANDER_SITE_ID) {
  const widget = document.createElement('evander-assistant'); widget.setAttribute('endpoint', import.meta.env.VITE_EVANDER_ENDPOINT); widget.setAttribute('site-id', import.meta.env.VITE_EVANDER_SITE_ID); root.prepend(widget);
}
registerTools({ manifestUrl: '/evander-webmcp/v1/tools', callUrl: '/evander-webmcp/v1/call' }).then(controller => { document.documentElement.dataset.evanderRegistered = controller ? 'ready' : 'unsupported'; }).catch(() => { document.documentElement.dataset.evanderRegistered = 'error'; });
