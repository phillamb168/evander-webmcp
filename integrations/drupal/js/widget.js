import { defineAssistant } from '@evander-webmcp/widget';
defineAssistant();
Drupal.behaviors.evanderAssistant = { attach() {
  const settings = drupalSettings.evanderWebmcp;
  if (!settings?.enableBackend || !settings.backendEndpoint || document.querySelector('evander-assistant')) return;
  const element = document.createElement('evander-assistant');
  element.setAttribute('endpoint', settings.backendEndpoint); element.setAttribute('site-id', settings.publicSiteId);
  document.body.prepend(element);
} };
