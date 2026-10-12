import { defineConfig } from '@playwright/test';
const frontend = (port, mode, chat = true) => ({
  command: `npm exec --workspace=@evander-webmcp/example-standalone -- vite --host 127.0.0.1 --port ${port} --strictPort ${mode === 'react' ? '--mode react' : ''}`,
  url: `http://127.0.0.1:${port}`, reuseExistingServer: false,
  env: { VITE_EVANDER_ENDPOINT: chat ? 'http://127.0.0.1:5280' : '', VITE_EVANDER_SITE_ID: 'portable-test' },
});
export default defineConfig({
  testDir: './chrome', timeout: 30000, workers: 1,
  use: { browserName: 'chromium', channel: 'chrome', screenshot: 'only-on-failure', trace: 'retain-on-failure' },
  webServer: [frontend(5274, 'plain'), frontend(5275, 'react'), frontend(5277, 'plain', false),
    ...(process.env.DRUPAL_FIXTURE ? [{ command: 'npm exec --workspace=@evander-webmcp/example-react-drupal -- vite --host 127.0.0.1 --port 5276 --strictPort', url: 'http://127.0.0.1:5276', reuseExistingServer: false, env: { TOOL_BASE_URL: process.env.DRUPAL_FIXTURE, VITE_EVANDER_ENDPOINT: 'http://127.0.0.1:5280', VITE_EVANDER_SITE_ID: 'portable-test' } }] : [])],
});
