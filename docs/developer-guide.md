# Developer-preview integration guide

## Two independent interfaces

Drupal serves the tool manifest and execution bridge. Its browser JavaScript
registers native WebMCP tools when the browser supports that API. This path does
not call the reference reasoning backend or require its key.

The optional shared assistant widget calls a reasoning backend. That backend
calls the same enabled Drupal plugins, then returns source excerpts and links.
Enabling chat is separate from enabling native browser tools.

Drupal exposes `GET /evander-webmcp/v1/tools` for tool definitions and
`POST /evander-webmcp/v1/call` for execution:

```json
{"name": "evander_read_page", "arguments": {"path": "/node/1"}}
```

These are tool-bridge endpoints, not a remote MCP JSON-RPC server. The native
bridge uses `document.modelContext` where supported; it does not install a polyfill.
Navigation changes the browser page and is separate from read-only server tools.

## Installation choices

1. Build the module artifact with `npm ci && npm run package`.
2. Copy `dist/evander_webmcp` into a site's custom modules directory, then enable
   `evander_webmcp` and rebuild Drupal caches.
3. Review public bundle/field/block/menu allowlists in the settings form. An
   empty bundle list permits all otherwise eligible node bundles; fields and
   blocks still require approval. Test as both anonymous and administrator.
4. If Search API is installed, enable `evander_webmcp_search_api`, select an
   enabled index and approved full-text fields, and populate the index. Keep
   content-access processing enabled. Installing this module does not create or
   populate a Search API index. Without one, configure navigation/sitemaps for
   label/path discovery, not full-text search.
5. Test real native tool invocation in a compatible browser. A registration
   marker or successful HTTP request is only a partial check.
6. Optionally configure the reference backend, HTTPS endpoint and site ID,
   enable chat, then test responses and keyboard/assistive-technology behavior.

## A custom public tool

Start from `integrations/drupal/modules/evander_webmcp_example`. That module is explicitly fictional
and optional; it must not be described as a live directory.

For a real extension, create a separate Drupal module depending on
`evander_webmcp:evander_webmcp`. Put an attributed plugin in
`src/Plugin/EvanderTool`, extend `ToolBase`, and implement `execute(array $arguments): array`.
Use a unique tool ID. The administrator must then enable it; discovery alone
does not expose every installed plugin.

`schema()` uses a deliberately limited JSON Schema subset: object, array,
string, integer, number, boolean, properties, required, additionalProperties,
items, enum, description/title, string lengths, numeric bounds and maxItems.
Objects must specify `additionalProperties: false`. Unsupported keywords fail
validation rather than being silently ignored. Use `ToolBase`'s empty schema
when there are no inputs.

Inject public API services through `ContainerFactoryPluginInterface`. Keep
credentials server-side, bound network time/response sizes, return generic
upstream errors, and distinguish unavailable from an affirmative empty result.
Treat every execution as anonymous: entity publication, entity access, field
access and route access must each be respected. Query access checks alone are
not enough. Read-only annotations do not sandbox extension PHP.

Custom results that the reference chat can ground use this shape:

```json
{
  "status": "ok",
  "coverage": "complete",
  "items": [{
    "id": "demo-north",
    "label": "Fictional North location — demo only",
    "facts": [{"label": "Notice", "value": "Fictional example, not live data."}],
    "links": [{"label": "North — official details", "url": "https://example.org/north"}]
  }]
}
```

Use stable IDs, meaningful link labels and verified destinations. Keep facts
short and include important qualifications next to the claim. The reference
renderer selects at most five source records and excerpts at most 700 characters
per source; do not put necessary eligibility warnings at the end of a long
unrelated record. This is not a comprehensive-summary guarantee. External
browser agents control their own summaries and may omit warnings or links;
test their actual outputs separately. A returned scheduling URL is not a booking.

## Rendered content and coverage

The page reader projects public node routes, approved rendered fields,
Paragraphs, Layout Builder and approved placed blocks. Heading/paragraph chunks
carry section anchors; large results use a snapshot and continuation offset.
Consumers should follow `next` where relevant and preserve partial-coverage
warnings. A missing excerpt is not proof that a fact is absent from the site.

Trusted extensions can use `hook_evander_webmcp_components_alter(&$components,
$node, &$omissions)` to add approved `namespace`/`build` render-array entries.
Such handlers must enforce public access and emit matching anchors in the
normal HTML page. This hook extends supported node content; it does not enable
arbitrary controllers or non-node routes. Never bypass missing content with raw
database fields, authenticated controller execution, or hidden DOM scraping.

## React and headless Drupal

Headless Drupal is the first intended integration: React hosts the UI while
Drupal provides the public-content/search/business tools. The shared component
only needs the reasoning backend contract, so it is not inherently tied to Drupal.

The React example now demonstrates native registration, chat, mapped routes and
rendered source sections. It is still not a complete headless Drupal frontend.
A separately hosted React app mounts `useWebMCP` and the optional `EvanderAssistant`
from the shared React package. The example includes a bounded fixed-target
development proxy; production hosting needs its own review. The Drupal module
does not inject scripts into another application's HTML.

Configure `SITE_ORIGIN` as the React browser origin and `TOOL_BASE_URL` as the
fixed Drupal source. These are intentionally separate: CORS checks the former;
source discovery is verified against the latter. Only the server has an
inference key. `VITE_EVANDER_ENDPOINT` and `VITE_EVANDER_SITE_ID` are public values.

The widget sends the browser path. A trusted route map resolves it to the source
path for backend and native current-page reads. The example maps `/` to the fixture
home and `/timeline` to its long page, rendering matching section IDs. Source URLs
remain canonical internally; only explicitly mapped links become frontend links.
Unmapped current pages are unavailable, and unmapped links retain their canonical
destinations. Drupal remains responsible for access checks; mapping is not authorization.

## Reference backend behavior

The backend defaults to four model calls and 12,000 accounted tokens per turn,
reserving the last call for a source-backed response. Verified evidence is bounded
to 18,000 bytes. Repeated static page reads are reused within a turn; continuation
and dynamic tools remain available. Insufficient evidence produces an inability
to answer, not an invented response.

Limit exhaustion returns HTTP 422 with `error: reasoning_limit`; upstream failures
return HTTP 502 with `error: assistant_unavailable`. The widget distinguishes these
states and preserves earlier links. Conversation state expires after 30 minutes
in memory; restarting the backend loses it. Clear conversation discards the
browser's session token, and abandoned server records expire.

For local configuration and HTTPS examples, see [development and testing](local-testing.md).
