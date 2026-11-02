import { beforeEach, describe, expect, it } from 'vitest';
import { eventHistory } from './event-history.ts';
import { createEvent } from './event.schema.ts';

function addEvents(severities: Array<'info' | 'warning' | 'critical'>) {
  // Added oldest first, so the history (newest first) is the reverse of this list.
  return severities.map((severity, i) => {
    const event = createEvent({ type: 'test', severity, message: `event ${i}` });
    eventHistory.add(event);
    return event;
  });
}

describe('eventHistory', () => {
  beforeEach(() => eventHistory.clear());

  it('returns the newest events first', () => {
    addEvents(['info', 'info', 'info']);
    const page = eventHistory.page({ first: 10 })!;
    expect(page.events.map((e) => e.message)).toEqual(['event 2', 'event 1', 'event 0']);
  });

  it('pages forward from a given event', () => {
    addEvents(['info', 'info', 'info', 'info', 'info']);
    const first = eventHistory.page({ first: 2 })!;
    expect(first.hasNextPage).toBe(true);

    const second = eventHistory.page({ first: 2, afterId: first.events.at(-1)!.id })!;
    expect(second.events.map((e) => e.message)).toEqual(['event 2', 'event 1']);
    expect(second.hasNextPage).toBe(true);

    const last = eventHistory.page({ first: 2, afterId: second.events.at(-1)!.id })!;
    expect(last.events.map((e) => e.message)).toEqual(['event 0']);
    expect(last.hasNextPage).toBe(false);
  });

  it('filters by severity and counts only matching events', () => {
    addEvents(['info', 'critical', 'warning', 'critical']);
    const page = eventHistory.page({ first: 10, severity: 'critical' })!;
    expect(page.totalCount).toBe(2);
    expect(page.events.every((e) => e.severity === 'critical')).toBe(true);
  });

  it('returns null for a cursor that is no longer in the history', () => {
    addEvents(['info']);
    expect(eventHistory.page({ first: 10, afterId: 'unknown-id' })).toBeNull();
  });

  it('keeps only the most recent 200 events', () => {
    addEvents(Array.from({ length: 205 }, () => 'info' as const));
    const page = eventHistory.page({ first: 1 })!;
    expect(page.totalCount).toBe(200);
    expect(page.events[0]!.message).toBe('event 204');
  });
});
