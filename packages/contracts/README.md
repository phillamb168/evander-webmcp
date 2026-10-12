# Public tool contracts

Version `1.0` is unchanged from the first Drupal preview. Any trusted site adapter
can implement `GET /evander-webmcp/v1/tools` and `POST /evander-webmcp/v1/call`.
These are HTTP tool-bridge endpoints, not a remote MCP JSON-RPC server.

- Manifest: `{version: "1.0", tools: [{name, title, description, inputSchema, annotations}]}`.
- Call: `{name, arguments}`. Only enabled, read-only server tools are in scope.
- Response: `{version: "1.0", result}`. Result status is `ok`, `unavailable` or `stale`.
- Discovery: `results: [{label, url, path}]`, `nextOffset`, `coverage` and optional notices.
- Page: `page: {title, url, path}`, `snapshot`, `chunks: [{id, heading, parents, text, anchor}]`,
  `links: [{label, url}]`, `coverage`, `omissions`, and `next: {path, offset, snapshot} | null`.
- Custom facts: `items: [{id, label, facts: [{label, value}], links: [{label, url}]}]`.
- Chat request: `{siteId, message, path, session?}`. `path` is the browser path, not
  authorization; a trusted backend route map resolves headless current-page reads.
- Chat response: `{answer, links, session, usage}`. Session tokens are private;
  inference credentials never travel through browser or CMS requests.

Exported `schemas` document envelope shapes. `validateManifest`, `validateEnvelope`,
`boundedJson` and `publicUrl` provide shared boundary checks; they do not replace
adapter-specific input validation, public access checks or authorization. Clients
tolerate missing version fields for older test adapters but reject an explicitly
unsupported version. New adapters must emit the version.

`fixtures.json` contains synthetic compatibility fixtures used by JS and PHP tests.
Missing evidence is not proof of absence; retain coverage and continuation metadata.
Keep important qualifications beside their fact. Dynamic custom tools must be read
again for current information. Browser clients control their own response wording.

## Headless route mapping

`createRouteMap({sourceOrigin, publicOrigin, routes})` accepts trusted deployment
configuration, never model output or browser-request configuration. A route has
`path` (frontend), `sourcePath`, optional `sourceAliases`, and either `anchors`
(explicit `#source` → `#frontend` mappings) or `preserveAnchors: true` when the
frontend really renders the source IDs. Query strings are not rewritten.

Use `resolveCurrentPath` for current-page reads and `mapSourceUrl` for link display
and navigation. Unknown routes return null for current-page reads; unknown links
keep their canonical source destination. Mapping never grants access. The browser
bridge still requires a link previously returned by a tool or present in the DOM,
and its final navigation destination must be same-origin.
