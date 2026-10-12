# 0.1.0-alpha.2

Portable developer preview: shared contracts, browser bridge, accessible widget
and React helpers, with Drupal separated into its own integration.

- Drupal retains existing configuration, tool endpoints, plugins and Search API behavior.
- Native WebMCP is independent of inference; optional chat uses the same site tools.
- React supports server-safe imports, SPA lifecycle, explicit route mappings and section focus.
- Plain HTML and React examples demonstrate a fictional non-CMS adapter.
- GitHub artifacts include the self-contained Drupal module, browser assets, JavaScript tarballs and checksums.

See `docs/migration-alpha2.md` in the source repository for changed source paths
and the backward-compatible backend configuration alias.

Human screen-reader validation and native browser-client compatibility testing
are ongoing. The backend remains a single-site reference with in-memory state;
example servers are development tools, not production hosting. WordPress, private
content, server write actions, remote MCP JSON-RPC hosting, managed inference and
npm registry publication are not included.
