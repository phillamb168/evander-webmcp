# React integration

React 19.2+ wrapper for the same accessible web component and browser bridge.
Install all four matching GitHub package tarballs together with React; these
preview packages are not published to npm. Import the widget stylesheet separately.

```jsx
import { EvanderAssistant, useWebMCP } from '@evander-webmcp/react';
import '@evander-webmcp/widget/widget.css';

// options is memoized trusted host configuration; routeKey changes with the route.
useWebMCP(options, routeKey);
return <EvanderAssistant endpoint={backendUrl} siteId={siteId}
  integration={options} routeKey={routeKey} />;
```

Mount the hook once in an app-shell component. It registers native tools after
mounting and removes them on unmount; unsupported browsers still support chat.
Imports and server rendering do not access browser globals. This is an integration
helper, not a complete headless frontend or a promise of every React framework's support.

Options are the browser bridge options plus an optional `onError` callback. For
headless sites, configure matching current-page and source-link mappings in the
browser and reasoning backend. Native WebMCP works when no backend is configured.
