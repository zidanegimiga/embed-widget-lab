import { useEffect, useState } from 'react';
import { useDraggable } from './useDraggable';
import { useEventStream } from './useEventStream';
import type { WidgetConfig } from './types';

export function Widget({ config }: { config: WidgetConfig }) {
  const { ref, style, handleProps, reclamp } = useDraggable();
  const { status, events, clear } = useEventStream(config);
  const [minimized, setMinimized] = useState(false);
  const [seen, setSeen] = useState(0);

  const unread = minimized ? Math.max(0, events.length - seen) : 0;
  useEffect(() => { if (!minimized) setSeen(events.length); }, [minimized, events.length]);
  useEffect(() => { reclamp(); }, [minimized]);

  return (
    <div ref={ref} className={`panel ${minimized ? 'min' : ''}`} style={style}>
      <header {...handleProps}>
        <span className={`dot ${status}`} title={status} />
        <strong>{config.title ?? 'HMIS Live'}</strong>
        <span className="meta">{config.transport ?? 'ws'}</span>
        {unread > 0 && <span className="badge">{unread}</span>}
        <button onClick={() => setMinimized((m) => !m)} aria-label="Toggle">
          {minimized ? '+' : '-'}
        </button>
      </header>

      {!minimized && (
        <>
          <ul>
            {events.length === 0 && <li className="empty">Waiting for events...</li>}
            {events.map((e) => (
              <li key={e.id} className={e.severity}>
                <div className="row">
                  <span className="type">{e.type}</span>
                  <time>{new Date(e.ts).toLocaleTimeString()}</time>
                </div>
                <div>{e.message}</div>
                {e.patient && <div className="patient">{e.patient}</div>}
              </li>
            ))}
          </ul>
          <footer>
            <span>{events.length} events</span>
            <button onClick={clear}>Clear</button>
          </footer>
        </>
      )}
    </div>
  );
}
