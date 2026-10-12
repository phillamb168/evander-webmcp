# Browser bridge

`registerTools({manifestUrl, callUrl, resolveCurrentPath?, mapSourceUrl?, navigate?, signal?})`
registers tools through the browser's native `document.modelContext` when available.
No polyfill, chat service or inference key is installed. Unsupported browsers return null.

The returned AbortController has `refresh()` to discard stale navigation evidence
after a route change and `abort()` to release registrations. Mount once per app
shell. `navigate` receives only a verified, same-origin final destination. It may
delegate to an SPA router. `focusSection(hash)` focuses a real DOM section.

The module can be imported on a server, but registration must run in the browser.
Use the built browser archive for direct ES module imports, or install the
contracts and browser tarballs together with npm. A site must supply the tool
endpoints; installing this module alone does not create searchable content.
