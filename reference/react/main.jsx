import React from 'react';
import { createRoot } from 'react-dom/client';
import EvanderAssistant from './EvanderAssistant.jsx';
import '../../css/widget.css';
const endpoint = import.meta.env.VITE_EVANDER_ENDPOINT || '';
const siteId = import.meta.env.VITE_EVANDER_SITE_ID || '';
createRoot(document.getElementById('root')).render(<main>
  <h1>Evander React integration example</h1>
  <p>This example uses the same assistant component as Drupal, with Drupal as its content source. It is not a complete headless frontend: page routes and section links still need integration. No inference key belongs in Vite variables.</p>
  {endpoint && siteId ? <EvanderAssistant endpoint={endpoint} siteId={siteId} /> : <p>Set VITE_EVANDER_ENDPOINT and VITE_EVANDER_SITE_ID to enable the assistant.</p>}
</main>);
