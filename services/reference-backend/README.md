# Reference reasoning backend

From the repository root, copy `.env.example` to ignored `.env`, configure your
server-side OpenRouter key and tool-capable model, then run `npm run backend`.
Use HTTPS for browser connections; see the repository's local testing guide.

`SITE_ORIGIN` is the exact browser origin; `TOOL_BASE_URL` is the fixed trusted tool
adapter base URL. They may differ. The backend uses the common versioned tool
routes for Drupal or a non-CMS adapter. `DRUPAL_TOOL_BASE` remains a deprecated
fallback; conflicting old and new settings fail startup.

`ROUTE_MAP_FILE` optionally names a trusted JSON route array shared with the
headless frontend. An unmapped current page returns unavailable; discovery still
works. Models cannot configure upstream hosts or mappings.

Defaults remain four model calls, 12,000 accounted tokens, and 18,000 bytes of
verified evidence per turn. The last model call is reserved for a source-backed
response. Static page reads are reused within a turn; custom tools are refreshed.
Limit exhaustion returns 422 `reasoning_limit`; upstream failure returns 502
`assistant_unavailable`. No prompt, tool payload or session token is logged.

This is a single-site evaluation service with in-memory rate limits and sessions
(30-minute expiry). It is not a production hosting platform. Native WebMCP does
not use this service. Container build: `docker build -f services/reference-backend/Dockerfile .`.
