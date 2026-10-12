# Accessible assistant widget

The shared `<evander-assistant endpoint="https://backend.example" site-id="demo">`
custom element calls the optional backend's `/v1/agent` endpoint. Import the module
and `widget.css`; `defineAssistant()` is idempotent and does nothing without a DOM.
It is safe to import during server rendering.

The element's optional `integration` property accepts trusted `mapSourceUrl` and
`navigate` callbacks. Call `refreshContext()` after an SPA route change to cancel
an outstanding answer for the previous page. The widget sends the browser path;
the backend must use the same trusted headless route map where applicable.

Responses use a polite live region without moving input focus. Returned links
remain available on close/reopen and recoverable errors. Clear conversation drops
the browser session token; abandoned server sessions expire. Cancellation does
not book, navigate, or mutate server content. Human screen-reader validation is
ongoing; this is not accessibility certification.
