export type Transport = 'ws' | 'sse';

export interface WidgetConfig {
  /** Base URL of the event server, e.g. http://localhost:4000 */
  url: string;
  transport?: Transport;
  title?: string;
  /** Sent as a query param. Browsers cannot set headers on WebSocket or EventSource. */
  token?: string;
}

export interface HmisEvent {
  id: string;
  type: string;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  patient?: string;
  ts: string;
}

export type ConnectionStatus = 'connecting' | 'open' | 'closed';
