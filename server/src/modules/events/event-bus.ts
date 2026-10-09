import { EventEmitter } from 'node:events';
import type { HmisEvent } from './event.schema.ts';

type Listener = (event: HmisEvent) => void;

/**
 * In-process pub/sub that decouples producers (RabbitMQ, fake, HTTP) from transports (WS, SSE).
 * To run several server instances, producers stay as they are: each instance has its own
 * exclusive RabbitMQ queue, so every instance sees every event.
 */
class EventBus {
  #emitter = new EventEmitter().setMaxListeners(0); // one listener per SSE client

  publish(event: HmisEvent) {
    this.#emitter.emit('event', event);
  }

  /** Returns an unsubscribe function. */
  subscribe(listener: Listener): () => void {
    this.#emitter.on('event', listener);
    return () => this.#emitter.off('event', listener);
  }
}

export const eventBus = new EventBus();
