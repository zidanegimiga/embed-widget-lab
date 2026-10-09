import { useEffect, useState } from 'react';
import type { ConnectionStatus, HmisEvent, WidgetConfig } from './types';

const MAX_EVENTS = 50;

/** Subscribes to the event server over WebSocket or SSE. */
export function useEventStream({ url, transport = 'ws', token }: WidgetConfig) {
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const [events, setEvents] = useState<HmisEvent[]>([]);

  useEffect(() => {
    const push = (raw: string) => {
      try {
        const evt = JSON.parse(raw) as HmisEvent;
        setEvents((prev) => [evt, ...prev].slice(0, MAX_EVENTS));
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

  return { status, events, clear: () => setEvents([]) };
}
