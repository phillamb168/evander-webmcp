import { registerTools, focusSection } from '@evander-webmcp/browser';

Drupal.behaviors.evanderSectionFocus = { attach() {
  if (!location.hash || document.documentElement.dataset.evanderFocusedHash === location.hash) return;
  let target; try { target = document.getElementById(decodeURIComponent(location.hash.slice(1))); } catch { return; }
  if (!target?.closest('[data-evander-section]')) return;
  document.documentElement.dataset.evanderFocusedHash = location.hash;
  focusSection(location.hash);
} };
Drupal.behaviors.evanderWebmcp = { attach() {
  if (document.documentElement.dataset.evanderRegistered || !document.modelContext) return;
  document.documentElement.dataset.evanderRegistered = 'true';
  registerTools(drupalSettings.evanderWebmcp).then(() => { document.documentElement.dataset.evanderRegistered = 'ready'; }).catch(() => { delete document.documentElement.dataset.evanderRegistered; });
} };
