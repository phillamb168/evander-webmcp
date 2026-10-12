# Development and testing

Use a source checkout and disposable local fixture sites. Do not run fixture
setup scripts against an existing site; they create and modify test content.

## Clean Drupal matrix

1. Under ignored `.local/drupal10` and `.local/drupal11`, create Drupal recommended-project installations using Composer, configure distinct DDEV project names `evander-preview10` and `evander-preview11`, and install Drupal. Do not run site-install in a pre-existing site.
2. `npm ci && npm run package`. Copy `dist/evander_webmcp` into each fixture's `web/modules/custom` directory.
3. Install `evander_webmcp` and `evander_webmcp_example`. Set each fixture's site name to begin with `Evander Drupal` (the seed guard).
4. Copy and run `tests/fixtures/seed.php` using `ddev drush php:script`; this creates only fictional test data. Run cache rebuild.
5. With Node trusting DDEV's CA, run `node tests/live-http.mjs https://evander-preview10.ddev.site` and repeat for 11.
6. Install Search API, Paragraphs and their dependencies via Composer; enable `evander_webmcp_search_api search_api_db paragraphs layout_builder`. Copy and run `tests/fixtures/components.php` once; rebuild caches. Run `tests/components-http.mjs` against each fixture.
7. Select index `preview` and fields `title`/`body` in the module settings, index it, and test `evander_find_pages` for `library` and an unpublished sentinel. Verify results by reading the returned page. Keep no-index and configured-but-broken-index cases in the regression matrix.

Fixture scripts check the expected site name or origin. Existing fixture content
can be updated with `seed.php`; component setup is intentionally one-shot.

## Local HTTPS chat

Configure `.env` from `.env.example`; use your own OpenRouter key. This file is ignored and excluded from the module package.

```sh
mkdir -p .local/tls
mkcert -cert-file .local/tls/localhost.pem -key-file .local/tls/localhost-key.pem localhost 127.0.0.1 ::1
NODE_EXTRA_CA_CERTS="$(mkcert -CAROOT)/rootCA.pem" DEV_TLS_CERT=.local/tls/localhost.pem DEV_TLS_KEY=.local/tls/localhost-key.pem npm run backend
```

This assumes mkcert's local CA is already trusted; never bypass a browser warning or disable TLS verification. Set the Drupal backend URL to `https://localhost:8180`, public site ID to the matching `.env` value, and enable the backend. The server binds loopback by default. Its startup checks OpenRouter's public model catalogue for the configured tool-capable model. Docker is an alternative behind your own HTTPS reverse proxy, not a local certificate bypass.

Synthetic live model smoke test (does incur provider usage):

```sh
NODE_EXTRA_CA_CERTS="$(mkcert -CAROOT)/rootCA.pem" node --env-file=.env tests/live-agent.mjs
NODE_EXTRA_CA_CERTS="$(mkcert -CAROOT)/rootCA.pem" node --env-file=.env tests/live-loop-regression.mjs
```

No model key is sent to Drupal or the browser. Disable the backend checkbox when done if the local server is stopped.

Both scripts use the same default four-model-call/12,000-token limits as the
reference server. The loop regression checks a discovery/factual-follow-up
conversation against an exact fixture fact and source link.

## Browser checks

Open the clean fixture in a compatible Chrome session. With chat disabled, normal site navigation must remain usable and the Drupal bridge should register without a backend. Verify tool invocation with the browser agent's actual Site tools interface. The `data-evander-registered="ready"` DOM marker only proves registration completed; it does not by itself prove a client can invoke those tools.

With chat enabled, check Enter and Ask submission, source links, input focus after
responses, section focus, close/reopen, clear, cancel and unavailable-backend states.
Also test announcements and keyboard navigation with NVDA or VoiceOver. Use only
fictional links for action tests; do not activate real booking flows.

The React example is client-only: `cd examples/react-drupal && npm ci && npm run build`. A React deployment needs a backend configured for its own origin and a public-content tool adapter; copying a component alone does not create a retrieval API.

For the local cross-origin example, run a second backend from the repository root
using the same ignored key file and trusted local certificate:

```sh
SITE_ORIGIN=http://localhost:5173 SITE_ID=evander-react-preview PORT=8182 NODE_EXTRA_CA_CERTS="$(mkcert -CAROOT)/rootCA.pem" DEV_TLS_CERT=.local/tls/localhost.pem DEV_TLS_KEY=.local/tls/localhost-key.pem node --env-file=.env services/reference-backend/server.mjs
```

In another shell, from `examples/react-drupal`:

```sh
VITE_EVANDER_ENDPOINT=https://localhost:8182 VITE_EVANDER_SITE_ID=evander-react-preview npm run dev -- --port 5173 --strictPort
```

Open `http://localhost:5173/` (the origin must match exactly). Ask to find the
community library page, then ask what happened in 2010. This uses the synthetic
Drupal source, not React-rendered page extraction. Keep the fixture's Search API
index populated. See the integration guide for
the route/anchor mapping and native bridge work required on a real headless site.
