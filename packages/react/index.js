import React, { useEffect, useRef } from 'react';
import { defineAssistant } from '@evander-webmcp/widget';
import { registerTools } from '@evander-webmcp/browser';

export function EvanderAssistant({ endpoint, siteId, integration, routeKey }) {
  const ref = useRef(null);
  useEffect(() => { if (ref.current) ref.current.integration = integration; defineAssistant(); }, [integration]);
  useEffect(() => { ref.current?.refreshContext?.(); }, [routeKey]);
  return React.createElement('evander-assistant', { ref, endpoint, 'site-id': siteId });
}

/** Memoize options in the host app. Call in one app-shell component, not per page. */
export function useWebMCP(options, routeKey) {
  const controller = useRef(null);
  useEffect(() => {
    if (!options) return;
    const abort = new AbortController();
    registerTools({ ...options, signal: abort.signal }).then(value => {
      if (abort.signal.aborted) value?.abort(); else controller.current = value;
    }).catch(error => { if (!abort.signal.aborted) options.onError?.(error); });
    return () => { abort.abort(); controller.current?.abort(); controller.current = null; };
  }, [options]);
  useEffect(() => { controller.current?.refresh(); }, [routeKey]);
}
export default EvanderAssistant;
