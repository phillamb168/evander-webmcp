# 0.1.0-alpha.1

Initial developer preview for Drupal 10.6 and 11. Requires PHP 8.3+.

## Included

- Native WebMCP registration for public page discovery, content reads and navigation.
- Optional Search API full-text discovery, with navigation/sitemap fallback.
- Paragraph-sized content chunks, section links, continuation and coverage metadata.
- Administrator allowlists and anonymous access checks.
- Drupal plugin extension points and a fictional read-only custom-tool example.
- Shared accessible chat widget, optional OpenRouter reference backend and React example.
- Source-backed excerpts and links, bounded reasoning and recoverable error states.

## Known limitations

Human screen-reader validation and browser-client compatibility testing are ongoing.
Custom routes, theme-only content and headless route/anchor mappings need integration.
The React example is not a complete headless frontend. The reference backend is
single-site and keeps sessions in memory; it needs additional operational controls
for public hosting. Private content, write actions, WordPress, remote MCP-server
hosting and managed inference are not included.

Please report your Drupal/module version, browser or agent client, reproduction
steps and expected result. For accessibility issues, include the screen reader
version and observed focus or announcement behavior. Do not include credentials
or sensitive information.
