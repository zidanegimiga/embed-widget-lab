import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  FakeEventSource,
  FakeWebSocket,
  graphqlPage,
  installFakeTransports,
  makeEvent,
  requestBody,
  stubFetch,
} from './test/fakes';
import { useEventStream } from './useEventStream';

const config = { url: 'http://localhost:4000', token: 'abc' };

beforeEach(() => installFakeTransports());

describe('useEventStream over SSE', () => {
  it('connects with the token and reports the connection status', async () => {
    stubFetch(graphqlPage([]));
    const { result } = renderHook(() => useEventStream({ ...config, transport: 'sse' }));
    const source = FakeEventSource.instances[0]!;

    expect(source.url).toBe('http://localhost:4000/events?token=abc');
    expect(result.current.status).toBe('connecting');

    act(() => source.open());
    expect(result.current.status).toBe('open');

    act(() => source.fail({ closed: true }));
    expect(result.current.status).toBe('closed');
  });

  it('shows live events newest first', async () => {
    stubFetch(graphqlPage([]));
    const { result } = renderHook(() => useEventStream({ ...config, transport: 'sse' }));
    const source = FakeEventSource.instances[0]!;

    act(() => source.emit(makeEvent({ message: 'first' })));
    act(() => source.emit(makeEvent({ message: 'second' })));

    expect(result.current.events.map((e) => e.message)).toEqual(['second', 'first']);
  });
});

describe('useEventStream history', () => {
  it('loads recent events after live ones, without duplicates', async () => {
    const shared = makeEvent({ message: 'in both' });
    stubFetch(graphqlPage([shared, makeEvent({ message: 'older' })]));

    const { result } = renderHook(() => useEventStream({ ...config, transport: 'sse' }));
    act(() => FakeEventSource.instances[0]!.emit(shared));

    await waitFor(() => expect(result.current.events).toHaveLength(2));
    expect(result.current.events.map((e) => e.message)).toEqual(['in both', 'older']);
  });

  it('pages back with the cursor until there is nothing left', async () => {
    const fetchMock = stubFetch(
      graphqlPage([makeEvent({ message: 'page 1' })], { hasNextPage: true, endCursor: 'cursor-1' }),
      graphqlPage([makeEvent({ message: 'page 2' })], { hasNextPage: false, endCursor: 'cursor-2' }),
    );
    const { result } = renderHook(() => useEventStream({ ...config, transport: 'sse' }));
    await waitFor(() => expect(result.current.hasMore).toBe(true));

    await act(() => result.current.loadOlder());

    expect(requestBody(fetchMock, 1).variables.after).toBe('cursor-1');
    expect(result.current.events.map((e) => e.message)).toEqual(['page 1', 'page 2']);
    expect(result.current.hasMore).toBe(false);
  });

  it('still streams live events when history is unavailable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    const { result } = renderHook(() => useEventStream({ ...config, transport: 'sse' }));

    act(() => FakeEventSource.instances[0]!.emit(makeEvent({ message: 'live' })));

    expect(result.current.events.map((e) => e.message)).toEqual(['live']);
    expect(result.current.hasMore).toBe(false);
  });
});

describe('useEventStream over WebSocket', () => {
  it('reconnects with exponential backoff after the connection drops', () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('no history')));
    const { result } = renderHook(() => useEventStream({ ...config, transport: 'ws' }));

    expect(FakeWebSocket.instances[0]!.url).toBe('ws://localhost:4000/ws?token=abc');

    act(() => FakeWebSocket.instances[0]!.drop());
    expect(result.current.status).toBe('closed');

    act(() => vi.advanceTimersByTime(999));
    expect(FakeWebSocket.instances).toHaveLength(1); // not yet: first retry waits 1s
    act(() => vi.advanceTimersByTime(1));
    expect(FakeWebSocket.instances).toHaveLength(2);

    act(() => FakeWebSocket.instances[1]!.drop());
    act(() => vi.advanceTimersByTime(1999));
    expect(FakeWebSocket.instances).toHaveLength(2); // second retry waits 2s
    act(() => vi.advanceTimersByTime(1));
    expect(FakeWebSocket.instances).toHaveLength(3);

    act(() => FakeWebSocket.instances[2]!.open());
    expect(result.current.status).toBe('open');
  });

  it('stops reconnecting once unmounted', () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('no history')));
    const { unmount } = renderHook(() => useEventStream({ ...config, transport: 'ws' }));

    unmount();
    act(() => vi.advanceTimersByTime(60_000));

    expect(FakeWebSocket.instances).toHaveLength(1);
  });
});
