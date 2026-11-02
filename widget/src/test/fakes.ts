// Test doubles for the browser APIs the widget talks to: EventSource, WebSocket and fetch.
import { vi } from 'vitest';
import type { HmisEvent } from '../types';

export class FakeEventSource {
  static readonly CLOSED = 2;
  static instances: FakeEventSource[] = [];

  url: string;
  readyState = 0;
  onopen: (() => void) | null = null;
  onerror: (() => void) | null = null;
  #listeners = new Map<string, ((e: MessageEvent) => void)[]>();

  constructor(url: string) {
    this.url = url;
    FakeEventSource.instances.push(this);
  }

  addEventListener(type: string, listener: (e: MessageEvent) => void) {
    this.#listeners.set(type, [...(this.#listeners.get(type) ?? []), listener]);
  }

  close() {
    this.readyState = FakeEventSource.CLOSED;
  }

  // Test controls
  open() {
    this.readyState = 1;
    this.onopen?.();
  }

  emit(event: HmisEvent) {
    const message = new MessageEvent('hmis', { data: JSON.stringify(event) });
    this.#listeners.get('hmis')?.forEach((listener) => listener(message));
  }

  fail({ closed }: { closed: boolean }) {
    this.readyState = closed ? FakeEventSource.CLOSED : 0;
    this.onerror?.();
  }
}

export class FakeWebSocket {
  static instances: FakeWebSocket[] = [];

  url: string;
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;

  constructor(url: string) {
    this.url = url;
    FakeWebSocket.instances.push(this);
  }

  /** Browsers fire onclose for client-initiated closes too. */
  close() {
    this.onclose?.();
  }

  // Test controls
  open() {
    this.onopen?.();
  }

  emit(event: HmisEvent) {
    this.onmessage?.({ data: JSON.stringify(event) });
  }

  /** The connection dropped (server restart, network loss). */
  drop() {
    this.onclose?.();
  }
}

export function installFakeTransports() {
  FakeEventSource.instances = [];
  FakeWebSocket.instances = [];
  vi.stubGlobal('EventSource', FakeEventSource);
  vi.stubGlobal('WebSocket', FakeWebSocket);
}

let sequence = 0;

export function makeEvent(overrides: Partial<HmisEvent> = {}): HmisEvent {
  sequence += 1;
  return {
    id: `event-${sequence}`,
    ts: '2026-11-02T08:00:00.000Z',
    type: 'vitals.assessed',
    severity: 'info',
    message: `Event ${sequence}`,
    ...overrides,
  };
}

/** The GraphQL response body for a page of recent events, as the server sends it. */
export function graphqlPage(events: HmisEvent[], pageInfo = { hasNextPage: false, endCursor: null as string | null }) {
  return {
    data: {
      recentEvents: {
        edges: events.map((e) => ({
          node: {
            id: e.id,
            type: e.type,
            severity: e.severity.toUpperCase(),
            message: e.message,
            patient: e.patient ?? null,
            source: e.source ?? null,
            ts: e.ts,
            details: Object.entries(e.details ?? {}).map(([label, value]) => ({ label, value: String(value) })),
          },
        })),
        pageInfo,
      },
    },
  };
}

/** Stubs fetch to return the given JSON bodies in order. Returns the mock for assertions. */
export function stubFetch(...bodies: object[]) {
  const fetchMock = vi.fn();
  for (const body of bodies) {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    );
  }
  fetchMock.mockRejectedValue(new Error('No more stubbed responses'));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

/** The parsed JSON body of the nth fetch call. */
export function requestBody(fetchMock: ReturnType<typeof vi.fn>, call = 0) {
  return JSON.parse(fetchMock.mock.calls[call]![1].body as string);
}
