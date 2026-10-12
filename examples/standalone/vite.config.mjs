import { defineConfig } from 'vite';
import { manifest, execute } from './adapter.mjs';
import { toolMiddleware } from '../shared/http.mjs';
export default defineConfig(({ mode }) => ({
  build: { outDir: mode === 'react' ? 'dist/react' : 'dist/plain' },
  plugins: [{ name: 'fictional-tools',
    transformIndexHtml: { order: 'pre', handler: html => mode === 'react' ? html.replace('/plain.js', '/react.jsx') : html },
    configureServer(server) { const origin = `http://127.0.0.1:${server.config.server.port || 5174}`; server.middlewares.use(toolMiddleware({ origin, manifest: () => manifest, call: body => execute(body, origin) })); },
  }],
}));
