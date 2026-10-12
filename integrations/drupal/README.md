# Evander WebMCP for Drupal

Requires Drupal 10.6 or 11 and PHP 8.3+. Download the installable
`evander_webmcp-0.1.0-alpha.2.tar.gz` asset from the GitHub release, and extract its
`evander_webmcp` folder into `web/modules/custom`:

```sh
drush en evander_webmcp -y
drush cr
```

The archive includes all browser JavaScript and CSS. Node is not needed on the Drupal host.
The repository source directory alone is not the installable module: its shared
assets are assembled by `npm ci && npm run package` from the repository root.

Open Configuration → Web services → Evander WebMCP
(`/admin/config/services/evander-webmcp`) and choose the public content fields,
bundles, menus and enabled tools. Requests use anonymous access even for logged-in
visitors. Keep access checks in custom plugins as well.

Compatible browser agents can discover tools, read content and navigate verified
links without any inference backend. For full-text discovery, install Search API,
enable `evander_webmcp_search_api`, choose a populated index and approved fields,
and retain the index's content-access processor. Without Search API, discovery
matches configured navigation/sitemap labels and paths, not full page text.

To add chat, run a reasoning backend from the full source repository, then enable
**Evander backend** here with its HTTPS URL and matching public site ID. Inference
keys stay on the backend, never in Drupal configuration or browser JavaScript.

The optional `evander_webmcp_example` submodule is a fictional read-only tool.
See the [developer guide](../../docs/developer-guide.md) for real plugins and
content handlers. Existing plugin namespaces, hooks, settings, tool names and
HTTP endpoints remain compatible with alpha.1. No database migration is required;
replace the module with the new archive and rebuild caches.

The shared assistant includes keyboard controls, live response announcements and
retained links. Human screen-reader validation is ongoing; test with your users.
