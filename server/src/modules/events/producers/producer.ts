/** Anything that feeds events into the bus. */
export interface EventProducer {
  readonly name: string;
  start(): Promise<void>;
  stop(): Promise<void>;
}
