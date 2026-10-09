import type { HmisEvent } from '../event.schema.ts';

/** Anything that feeds events into the bus. */
export interface EventProducer {
  readonly name: string;
  start(): Promise<void>;
  stop(): Promise<void>;
  /** Accepts an event pushed in through the API and routes it to every server instance. */
  ingest(event: HmisEvent): Promise<void>;
}
