import { useCallback, useEffect, useState } from 'react';
import { fetchRecentEvents } from './api/recent-events';
import type { ConnectionStatus, HmisEvent, WidgetConfig } from './types';

const MAX_EVENTS = 200;
const PAGE_SIZE = 20;

/** Adds events that are not already in the list, newest-first order preserved. */
function merge(existing: HmisEvent[], incoming: HmisEvent[], position: 'start' | 'end') {
  const seen = new Set(existing.map((e) => e.id));
  const fresh = incoming.filter((e) => !seen.has(e.id));
  const merged = position === 'start' ? [...fresh, ...existing] : [...existing, ...fresh];
  return merged.slice(0, MAX_EVENTS);
}

/**
 * Live events over WebSocket or SSE, plus recent history over GraphQL so the list is not
 * empty after a reload. An event can arrive through both; it is shown once.
 */
export function useEventStream({ url, transport = 'ws', token }: WidgetConfig) {
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const [events, setEvents] = useState<HmisEvent[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);

  // Live stream.
  useEffect(() => {
    const push = (raw: string) => {
      try {
        const event = JSON.parse(raw) as HmisEvent;
        setEvents((prev) => merge(prev, [event], 'start'));
      } catch {}
    };
    const qs = token ? `?token=${encodeURIComponent(token)}` : '';

    if (transport === 'sse') {
      // EventSource reconnects on its own.
      const es = new EventSource(`${url}/events${qs}`);
      es.onopen = () => setStatus('open');
      es.onerror = () => setStatus(es.readyState === EventSource.CLOSED ? 'closed' : 'connecting');
      es.addEventListener('hmis', (e) => push((e as MessageEvent).data));
      return () => es.close();
    }

    // WebSocket has no built-in reconnect, so back off and retry.
    let ws: WebSocket | null = null;
    let retry = 0;
    let timer: ReturnType<typeof setTimeout>;
    let disposed = false;

    const connect = () => {
      setStatus('connecting');
      ws = new WebSocket(`${url.replace(/^http/, 'ws')}/ws${qs}`);
      ws.onopen = () => { retry = 0; setStatus('open'); };
      ws.onmessage = (e) => push(e.data);
      ws.onclose = () => {
        if (disposed) return;
        setStatus('closed');
        timer = setTimeout(connect, Math.min(1000 * 2 ** retry++, 15000));
      };
    };
    connect();

    return () => {
      disposed = true;
      clearTimeout(timer);
      ws?.close();
    };
  }, [url, transport, token]);

  // Recent history, once per server. Optional: if it fails, the live stream still works.
  useEffect(() => {
    const controller = new AbortController();
    fetchRecentEvents({ url, token }, { first: PAGE_SIZE }, controller.signal).then(
      (page) => {
        setEvents((prev) => merge(prev, page.events, 'end'));
        setCursor(page.endCursor);
        setHasMore(page.hasNextPage);
      },
      () => {},
    );
    return () => controller.abort();
  }, [url, token]);

  const loadOlder = useCallback(async () => {
    if (!hasMore || loadingOlder) return;
    setLoadingOlder(true);
    try {
      const page = await fetchRecentEvents({ url, token }, { first: PAGE_SIZE, after: cursor });
      setEvents((prev) => merge(prev, page.events, 'end'));
      setCursor(page.endCursor);
      setHasMore(page.hasNextPage);
    } catch {
      setHasMore(false); // e.g. the cursor expired; stop offering more
    } finally {
      setLoadingOlder(false);
    }
  }, [url, token, cursor, hasMore, loadingOlder]);

  return { status, events, hasMore, loadingOlder, loadOlder, clear: () => setEvents([]) };
}
