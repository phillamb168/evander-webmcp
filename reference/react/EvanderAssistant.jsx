import React from 'react';
import '../../js/widget.js';
// Load css/widget.css from the same release. No duplicate React implementation.
export default function EvanderAssistant({ endpoint, siteId }) {
  return React.createElement('evander-assistant', { endpoint, 'site-id': siteId });
}
