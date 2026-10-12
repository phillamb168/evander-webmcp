# Headless Drupal example

This renders the disposable Drupal fixture's public passages in React, using
actual source anchors. `routes.json` maps `/` to `/node/1` and `/timeline` to
`/node/2`. It is not a complete Drupal frontend.

From the repository root, with the fixture running and its certificate trusted:

```sh
npm ci
TOOL_BASE_URL=https://evander-preview10.ddev.site npm run example:drupal
```

Open `http://127.0.0.1:5173/`. Set `NODE_EXTRA_CA_CERTS` to your trusted local CA
when required. Do not disable certificate verification. The development proxy
permits only the two fixed tool endpoints, bounds requests and responses, and
never forwards browser cookies or authorization headers.

Native WebMCP needs no reasoning backend. To add chat, configure a backend with
`SITE_ORIGIN=http://127.0.0.1:5173`, the Drupal `TOOL_BASE_URL`, and
`ROUTE_MAP_FILE=examples/react-drupal/routes.json`. Start the frontend with matching
`VITE_EVANDER_ENDPOINT` and `VITE_EVANDER_SITE_ID`. Only public settings belong in
Vite variables; the inference key stays on the backend.

Navigation and current-page reading follow the trusted map. Source URLs remain
canonical internally. Only mapped links navigate within React; unmapped links
retain their original destinations. Map additional routes and render their actual
section IDs before claiming they are supported. The development proxy does not
ship in the static build; production routing and hosting need their own review.
