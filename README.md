# Evander WebMCP

Evander takes its name from the legendary Greek figure credited with bringing the
alphabet to Italy. The name reflects the project's aim: opening new ways for
people to access and interact with information.

Expose public Drupal content to browser agents through WebMCP, and optionally add
an accessible on-page chat assistant. Both interfaces use the same Drupal tools;
WebMCP works without a reasoning backend.

**Developer preview — 0.1.0-alpha.1.** Requires Drupal 10.6 or 11 and PHP 8.3+.

## Install and configure

Extract the module archive into `web/modules/custom/evander_webmcp`, then run:

```sh
drush en evander_webmcp -y
drush cr
```

Open **Configuration → Web services → Evander WebMCP**
(`/admin/config/services/evander-webmcp`) and select the public content fields,
bundles, menus and tools to expose. All requests use anonymous access, even when
the caller is logged in.

Compatible browsers can discover and call the registered tools to find pages,
read content and navigate to verified pages or sections. Browsers without native
WebMCP support can still use the optional chat assistant.

For full-text search, install Search API, enable `evander_webmcp_search_api`, and
select a populated index and public search fields. Keep the index's content-access
processor enabled. Without Search API, discovery searches configured navigation
and sitemap labels/paths rather than full page text.

## Optional chat assistant

The source repository includes a self-hosted OpenRouter reference backend:

1. Copy `.env.example` to `.env`. Configure your server-side API key, tool-capable
   model, Drupal origin, browser origin and site ID.
2. Run `npm run backend` with Node 22+, using HTTPS for browser connections.
3. Enable **Evander backend** in the Drupal settings and enter the backend URL
   and matching public site ID. Never put an inference key in Drupal configuration
   or browser code.

The assistant returns source excerpts and links. It includes keyboard controls,
response announcements and retained links. Human screen-reader validation is
ongoing; test it with your site's users and assistive technologies.

The reference backend uses single-site, in-memory sessions and is intended for
evaluation. See [security and privacy](SECURITY.md) before hosting it publicly.
A managed Evander inference service is not yet available.

## Extend and develop

Add business tools through Drupal plugins; the optional
`evander_webmcp_example` module demonstrates a fictional read-only directory.
The shared widget also has a React integration example in `reference/react`.

See the [integration guide](docs/developer-guide.md) for tool contracts, content
handlers and headless integration, or [development and testing](docs/local-testing.md)
for local HTTPS setup and test fixtures.

From a source checkout, with Node 22+ and PHP 8.3+:

```sh
npm ci
npm run verify
```

This runs offline tests and builds/audits `dist/evander_webmcp`. The installable
module does not require Node; the backend, React example and tests are available
separately in the source repository.

Contributions should be submitted as pull requests with tests for changed behavior.

## Preview scope

Public, published node content and read-only server tools are supported. Custom
routes, theme-only content and headless route/section mappings need integration.
Page responses report partial coverage where applicable. Private content, write
actions and a remote MCP JSON-RPC server are not included.

## License

[GPL-2.0-or-later](LICENSE). The shared-tool approach and some generic content
and section-anchor patterns grew out of work alongside the Audio Description
Project (ADP).
