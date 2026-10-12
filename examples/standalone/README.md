# Standalone, non-CMS example

Fictional library content provides discovery, page/section reads, continuation and
one opening-hours tool. Both interfaces use the same adapter. No external data,
scraping, accounts or inference is needed to use the native tools.

From the repository root:

```sh
npm ci
npm run example:standalone
```

Open `http://127.0.0.1:5174/`. For the React frontend, stop that example server and
run `npm run dev:react --workspace=@evander-webmcp/example-standalone` on the same
port. The content paths are identical, so no headless mapping is required.

To enable chat, start the reference backend with `SITE_ORIGIN` and `TOOL_BASE_URL`
both set to `http://127.0.0.1:5174`, a matching `SITE_ID`, and your server-side key.
Unset any conflicting legacy `DRUPAL_TOOL_BASE` value in your local configuration.
Start the example with public `VITE_EVANDER_ENDPOINT` and `VITE_EVANDER_SITE_ID`
values. Do not expose the inference key through Vite.

Try “Find pages about the library”, “What happened in 2010?”, and “What are the
fictional library opening hours?” Ask the browser agent to navigate to a returned
section. Unknown pages report unavailable, not invented content.

The Vite middleware supplies local tool endpoints. A static frontend build alone
does not supply these endpoints: deploy a reviewed adapter alongside it for real
hosting. The example middleware is for development, not a production API server.
