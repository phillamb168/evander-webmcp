import { defineConfig } from 'vite';
import { fixedToolProxy } from '../shared/http.mjs';
export default defineConfig(() => {
  const toolBase = (process.env.TOOL_BASE_URL || 'https://evander-preview10.ddev.site').replace(/\/$/, '');
  return { define: { __SOURCE_ORIGIN__: JSON.stringify(new URL(toolBase).origin) }, plugins: [{ name: 'fixed-drupal-tools', configureServer(server) {
    server.middlewares.use(fixedToolProxy({ toolBase, origin: `http://127.0.0.1:${server.config.server.port || 5173}` }));
  } }] };
});
