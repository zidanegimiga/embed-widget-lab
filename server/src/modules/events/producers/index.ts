import { config } from '../../../config/env.ts';
import { HttpError } from '../../../lib/http-error.ts';
import { logger } from '../../../lib/logger.ts';
import type { HmisEvent } from '../event.schema.ts';
import { createFakeProducer } from './fake.producer.ts';
import type { EventProducer } from './producer.ts';
import { createRabbitMQProducer } from './rabbitmq.producer.ts';

let active: EventProducer | null = null;

/** Routes an ingested event through whichever producer is running. */
export function ingestEvent(event: HmisEvent) {
  if (!active) throw new HttpError(503, 'Event pipeline is not ready');
  return active.ingest(event);
}

/** Starts RabbitMQ if configured. Outside production, falls back to fake events if it is unreachable. */
export async function startEventProducer(): Promise<EventProducer> {
  if (config.RABBITMQ_URL) {
    const rabbit = createRabbitMQProducer();
    try {
      await rabbit.start();
      logger.info({ exchange: config.RABBITMQ_EXCHANGE }, 'Consuming events from RabbitMQ');
      return (active = rabbit);
    } catch (err) {
      if (config.isProduction) throw err; // never serve fake clinical data in production
      logger.warn({ reason: (err as Error).message }, 'RabbitMQ unavailable, falling back to fake events');
    }
  }

  const fake = createFakeProducer(config.FAKE_EVENT_INTERVAL_MS);
  await fake.start();
  logger.info({ intervalMs: config.FAKE_EVENT_INTERVAL_MS }, 'Emitting fake events');
  return (active = fake);
}
