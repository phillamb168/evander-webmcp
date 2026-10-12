import { publicUrl } from '@evander-webmcp/contracts';
/** Safe to import on a server; definition and DOM work happen only in a browser. */
export function defineAssistant() {
if (!globalThis.customElements || !globalThis.HTMLElement) return null;
if (customElements.get('evander-assistant')) return customElements.get('evander-assistant');
class EvanderAssistant extends HTMLElement {
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
      if (this.controller !== controller || controller.signal.aborted) return;
      this.token = result.session;
      try { sessionStorage.setItem(this.sessionKey, this.token); } catch { /* Storage optional. */ }
      this.links.replaceChildren();
      for (const item of result.links ?? []) {
        const source = publicUrl(item.url, location.href); if (!source) continue;
        const mapped = this.integration?.mapSourceUrl?.(source);
        const destination = mapped && publicUrl(mapped, location.href) && new URL(mapped, location.href).origin === location.origin ? mapped : source;
        const url = new URL(destination, location.href);
        const link = document.createElement('a'); link.href = url.href; link.textContent = item.label;
        if (url.origin !== location.origin) { link.target = '_blank'; link.rel = 'noopener noreferrer'; }
        link.addEventListener('click', event => {
          if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
          if (url.origin === location.origin && url.pathname === location.pathname && url.hash) {
            let target; try { target = document.getElementById(decodeURIComponent(url.hash.slice(1))); } catch { return; }
            if (target) { event.preventDefault(); target.tabIndex = -1; target.focus({ preventScroll: true }); target.scrollIntoView?.({ block: 'start' }); return; }
          }
          if (url.origin === location.origin && this.integration?.navigate) { event.preventDefault(); this.integration.navigate(url.href); }
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
  disconnectedCallback() { this.refreshContext(); }
  refreshContext() {
    if (!this.controller) return;
    this.controller.abort(); this.controller = null;
    this.response.textContent = 'Request cancelled.';
    this.querySelector('[type=submit]').disabled = false;
    this.querySelector('.evander-cancel').hidden = true;
  }
}

customElements.define('evander-assistant', EvanderAssistant);
return EvanderAssistant;
}
defineAssistant();
