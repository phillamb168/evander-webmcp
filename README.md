# Evander WebMCP

Evander takes its name from the legendary Greek figure credited with bringing the
alphabet to Italy. The name reflects the project's aim: opening new ways for
people to access and interact with information.

Expose public site tools to compatible browser agents through WebMCP, and optionally
add an accessible on-page assistant. Both interfaces use the same tools. Native
WebMCP does not require an inference backend or an AI subscription from the site owner.

**Developer preview — 0.1.0-alpha.2.** Public content and read-only server tools.
Browser navigation is a separate, user-requested client action.

## Choose an integration

- [Drupal](integrations/drupal/README.md): install the self-contained module archive;
  optional Search API discovery. Requires Drupal 10.6 or 11 and PHP 8.3+; no Node build needed.
- [React](packages/react/README.md): the shared widget plus native WebMCP lifecycle
  helpers. Use the [headless Drupal example](examples/react-drupal/README.md), or your own tool adapter.
- [Non-CMS sites](examples/standalone/README.md): runnable plain HTML and React examples
  backed by curated fictional content, with no CMS dependency.
- WordPress: planned, not included in this preview.

Installing a widget does not automatically index a website. The site integration
supplies public content, search, tools and access enforcement.

## Shared components

`packages/contracts` defines the tool/content boundary; `packages/browser` registers
native browser tools; `packages/widget` implements the accessible assistant;
`packages/react` wraps those components. Drupal-specific PHP and initialization live
in `integrations/drupal`. There is only one widget implementation.

The optional [reference backend](services/reference-backend/README.md) uses
OpenRouter with a configured tool-capable model. Visitors do not need their own
AI account; the operator pays for inference. The backend is single-site and uses
in-memory sessions. See [security and privacy](SECURITY.md) before public hosting.
Managed Evander inference is not yet available.

## Develop and extend

With Node 22+ and PHP 8.3+:

```sh
npm ci
npm run verify
npm run build
```

Verification includes offline regressions, package audits and installation of the
actual JavaScript tarballs outside this workspace. Builds produce self-contained
Drupal/browser archives and JavaScript package tarballs under `dist`; these are
GitHub downloads, not npm registry releases. Examples and the backend run from a
source checkout. See [testing](docs/local-testing.md), [contracts](packages/contracts/README.md),
[Drupal extension points](docs/developer-guide.md), and [migration](docs/migration-alpha2.md).

Human screen-reader validation and browser-client compatibility testing are ongoing.
Private content, server write actions, remote MCP JSON-RPC hosting, and a complete
headless CMS application are not included. Please submit contributions as pull
requests with tests, and report reproduction steps without sensitive information.

## License

[GPL-2.0-or-later](LICENSE). The shared-tool approach and some generic content and
section-anchor patterns grew out of work alongside the Audio Description Project (ADP).
