/** Framework-neutral light-DOM custom element: React uses this same component. */
export class EvanderAssistant extends HTMLElement {
  connectedCallback() {
    if (this.initialized) return;
    this.initialized = true;
    this.sessionKey = `evander:${this.getAttribute('site-id')}`;
    this.innerHTML = `<button type="button" class="evander-open" aria-expanded="false">Open site assistant</button>
      <section class="evander-panel" hidden aria-label="Site assistant">
      <h2>Site assistant</h2><p>Answers use public site content. Please do not enter personal or sensitive information.</p>
      <button type="button" class="evander-close">Close site assistant</button>
      <div class="evander-response" role="status" aria-live="polite" aria-atomic="true"></div>
      <div class="evander-links" aria-label="Response links"></div>
      <form><label>Ask about this site <input name="question" type="text" maxlength="2000" autocomplete="off" required></label>
      <button type="submit">Ask</button><button type="button" class="evander-cancel" hidden>Cancel request</button></form>
      <button type="button" class="evander-clear">Clear conversation</button></section>`;
    this.opener = this.querySelector('.evander-open'); this.panel = this.querySelector('.evander-panel');
    this.panel.id = `evander-panel-${crypto.randomUUID()}`; this.opener.setAttribute('aria-controls', this.panel.id);
    this.input = this.querySelector('input'); this.response = this.querySelector('.evander-response'); this.links = this.querySelector('.evander-links');
    this.opener.addEventListener('click', () => { this.panel.hidden = false; this.opener.setAttribute('aria-expanded', 'true'); this.input.focus(); });
    this.querySelector('.evander-close').addEventListener('click', () => { this.panel.hidden = true; this.opener.setAttribute('aria-expanded', 'false'); this.opener.focus(); });
    this.querySelector('form').addEventListener('submit', event => { event.preventDefault(); if (!this.controller && this.input.value.trim()) this.ask(this.input.value.trim()); });
    this.querySelector('.evander-cancel').addEventListener('click', () => { this.controller?.abort(); this.input.focus(); });
    this.querySelector('.evander-clear').addEventListener('click', () => {
      this.controller?.abort(); this.controller = null; this.token = null;
      try { sessionStorage.removeItem(this.sessionKey); } catch { /* Storage optional. */ }
      this.querySelector('[type=submit]').disabled = false; this.querySelector('.evander-cancel').hidden = true;
      this.links.replaceChildren(); this.response.textContent = 'Conversation cleared.'; this.input.value = ''; this.input.focus();
    });
    try { this.token = sessionStorage.getItem(this.sessionKey); } catch { /* Storage optional. */ }
  }

  async ask(message) {
    const controller = new AbortController(); this.controller = controller;
    this.response.textContent = 'Working on it…'; this.input.value = ''; this.input.focus();
    this.querySelector('[type=submit]').disabled = true; this.querySelector('.evander-cancel').hidden = false;
    try {
      const endpoint = this.getAttribute('endpoint').replace(/\/$/, '');
      const response = await fetch(`${endpoint}/v1/agent`, { method: 'POST', signal: controller.signal, credentials: 'omit', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ siteId: this.getAttribute('site-id'), message, path: location.pathname, session: this.token }) });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        const error = new Error('Assistant unavailable');
        if (response.status === 422 && data.error === 'reasoning_limit') error.name = 'ReasoningLimitError';
        throw error;
      }
      const result = await response.json();
      if (this.controller !== controller) return;
      this.token = result.session;
      try { sessionStorage.setItem(this.sessionKey, this.token); } catch { /* Storage optional. */ }
      this.links.replaceChildren();
      for (const item of result.links ?? []) {
        const url = new URL(item.url, location.href);
        if (!['http:', 'https:'].includes(url.protocol)) continue;
        const link = document.createElement('a'); link.href = url.href; link.textContent = item.label;
        if (url.origin !== location.origin) { link.target = '_blank'; link.rel = 'noopener noreferrer'; }
        link.addEventListener('click', event => {
          if (url.origin === location.origin && url.pathname === location.pathname && url.hash) {
            const target = document.getElementById(decodeURIComponent(url.hash.slice(1)));
            if (target) { event.preventDefault(); target.tabIndex = -1; target.focus({ preventScroll: true }); target.scrollIntoView({ block: 'start' }); }
          }
        });
        const p = document.createElement('p'); p.append(link); this.links.append(p);
      }
      this.response.textContent = result.answer;
    } catch (error) {
      if (this.controller === controller) this.response.textContent = error.name === 'AbortError' ? 'Request cancelled.' : error.name === 'ReasoningLimitError' ? 'I could not finish this answer within the request limit. Try a more specific question, or use the site’s navigation and search.' : 'The assistant is unavailable. You can still use the site’s navigation and search.';
    } finally {
      if (this.controller === controller) {
        this.controller = null;
        this.querySelector('[type=submit]').disabled = false; this.querySelector('.evander-cancel').hidden = true;
      }
    }
  }
  disconnectedCallback() { this.controller?.abort(); }
}

if (!customElements.get('evander-assistant')) customElements.define('evander-assistant', EvanderAssistant);
if (window.Drupal) Drupal.behaviors.evanderAssistant = { attach() {
  const settings = drupalSettings.evanderWebmcp;
  if (!settings?.enableBackend || !settings.backendEndpoint || document.querySelector('evander-assistant')) return;
  const element = document.createElement('evander-assistant');
  element.setAttribute('endpoint', settings.backendEndpoint); element.setAttribute('site-id', settings.publicSiteId);
  document.body.prepend(element);
} };
