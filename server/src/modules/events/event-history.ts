import type { HmisEvent } from './event.schema.ts';

const MAX_EVENTS = 200;

export interface HistoryPage {
  events: HmisEvent[];
  hasNextPage: boolean;
  totalCount: number;
}

/**
 * The most recent events, newest first, so a widget can show history after a reload.
 *
 * In memory and per instance. Every instance receives every event through the RabbitMQ
 * fanout, so their histories match for events since startup. A production system would
 * persist events in a database and query that instead.
 */
class EventHistory {
  #events: HmisEvent[] = [];

  add = (event: HmisEvent) => {
    this.#events.unshift(event);
    if (this.#events.length > MAX_EVENTS) this.#events.length = MAX_EVENTS;
  };

  /**
   * Returns up to `first` events after the event with id `afterId`, optionally filtered by
   * severity. Returns null if `afterId` is no longer in the history (evicted or unknown).
   */
  page({ first, afterId, severity }: { first: number; afterId?: string; severity?: HmisEvent['severity'] }): HistoryPage | null {
    const matching = severity ? this.#events.filter((e) => e.severity === severity) : this.#events;

    let start = 0;
    if (afterId) {
      const index = matching.findIndex((e) => e.id === afterId);
      if (index === -1) return null;
      start = index + 1;
    }

    return {
      events: matching.slice(start, start + first),
      hasNextPage: start + first < matching.length,
      totalCount: matching.length,
    };
  }

  /** For tests. */
  clear() {
    this.#events = [];
  }
}

export const eventHistory = new EventHistory();
