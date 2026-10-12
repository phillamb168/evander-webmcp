# Development and testing

Run `npm ci`, `npm run verify`, and `npm run build` from the repository root.
One workspace lockfile covers shared components and examples. Verification runs
offline regressions, PHP assertions, audits and isolated tarball consumer tests.

## Disposable Drupal fixtures

Use the ignored `.local/drupal10` and `.local/drupal11` DDEV fixtures, named
`evander-preview10` and `evander-preview11`. For fresh installations, create new
recommended-project sites in disposable directories; never run site-install or
fixture seed scripts against an existing customer site.

Build and copy `dist/evander_webmcp` into each fixture's custom modules directory.
Enable the module and example submodule; fixture site names must start with
`Evander Drupal`. Run `tests/fixtures/seed.php` with Drush only on those fixtures.
For component checks install Search API, Paragraphs, Layout Builder and
`search_api_db`; the component seed is one-shot and must not be rerun on already
seeded content. Rebuild caches and index the fixture Search API index as needed.

With Node trusting DDEV's CA, run `tests/live-http.mjs` and
`tests/components-http.mjs` with each fixture's HTTPS origin as their argument.
Run `tests/fixtures/access.php` in each fixture for access and Search API checks.
Cover unconfigured search, working Search API, and configured-but-unavailable search.
For upgrade checks, install the alpha.1 archive first, then replace only the
module files with alpha.2 and rebuild caches; settings must remain unchanged.

## Live inference and local TLS

Copy `.env.example` to ignored `.env`; keep the model key there. Generate a trusted
local certificate under `.local/tls` using mkcert. Start the backend with
`DEV_TLS_CERT`, `DEV_TLS_KEY` and `NODE_EXTRA_CA_CERTS` pointing to your certificate,
key and local CA. Never disable TLS verification. Node 22+ is required.

`node --env-file=.env tests/live-agent.mjs` and `tests/live-loop-regression.mjs`
make real, billable model calls against synthetic Drupal content only. Configure
the fixture origin and legacy alias or generic tool base accordingly. No customer
content or real scheduling transactions belong in these tests.

## Examples and Chrome

With Google Chrome installed, `npm run test:chrome` starts isolated local example
servers and checks plain HTML, React, native-only mode, tool HTTP responses, chat
controls and focus. It uses a **modelContext registration harness**, not a real
external agent; chat success/error responses in this suite are fixtures.

Set `DRUPAL_FIXTURE=https://evander-preview10.ddev.site` (or the Drupal 11 fixture)
and `NODE_EXTRA_CA_CERTS` to your DDEV CA to also exercise the headless Drupal
example against real content and continuation endpoints. Ports 5274–5277 must be
free. Browser traces and failure screenshots remain in ignored `test-results/`.

Follow the source repository's example READMEs for plain HTML, standalone React
and headless Drupal. Test both native tools with chat disabled and chat with its
backend configured. Include discovery, current page, continuation, mapped source
links, navigation, section focus, SPA back/forward, close/reopen, clear, cancel,
unavailable backend and reasoning-limit recovery.

Browser registration alone does not prove native agent invocation. Record actual
Site tools calls where the client supports them, and label any registration-only
checks accurately. Human VoiceOver/NVDA testing remains separate and ongoing.

For opt-in, billable Chrome chat checks against fictional non-CMS content and the
Drupal 10 fixture, configure `.env` and run
`RUN_LIVE_PORTABLE=1 node tests/live-portable-chrome.mjs` with the local CA trusted.
This starts and stops its own example/backend processes on ports 5294–5296 and
checks six grounded turns, source links, follow-up context and section focus.
It does not invoke an external native WebMCP agent or use customer content.
