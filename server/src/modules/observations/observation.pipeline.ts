import { randomUUID } from 'node:crypto';
import { HttpError } from '../../lib/http-error.ts';
import { logger } from '../../lib/logger.ts';
import { createResilientChannel } from '../../lib/rabbitmq.ts';
import { createEvent } from '../events/event.schema.ts';
import { ingestEvent } from '../events/producers/index.ts';
import { observationSchema, type Observation } from './observation.schema.ts';
import { processObservation } from './processors/index.ts';

const QUEUE = 'hmis.observations';
const PREFETCH = 10; // observations processed in parallel per instance

type Worker = ReturnType<typeof createResilientChannel>;
let worker: Worker | null = null;

async function processAndPublish(observationId: string, observation: Observation) {
  const event = createEvent(processObservation(observation));
  await ingestEvent(event);
  logger.info({ observationId, eventId: event.id, severity: event.severity }, 'Observation processed');
}

/**
 * With a broker: observations go on a durable work queue, so they survive restarts and any
 * instance can process them (competing consumers). Without one (local dev): processed inline.
 */
export async function startObservationPipeline({ useQueue }: { useQueue: boolean }) {
  if (!useQueue) {
    logger.info('Processing observations inline (no broker)');
    return;
  }

  worker = createResilientChannel('observations', async (ch) => {
    await ch.assertQueue(QUEUE, { durable: true });
    await ch.prefetch(PREFETCH);
    await ch.consume(QUEUE, async (msg) => {
      if (!msg) return;
      try {
        const { id, observation } = JSON.parse(msg.content.toString());
        await processAndPublish(id, observationSchema.parse(observation));
        ch.ack(msg);
      } catch (err) {
        // Retry once in case the failure was transient, then drop it.
        const retry = !msg.fields.redelivered;
        logger.error({ err, retry }, 'Failed to process observation');
        ch.nack(msg, false, retry);
      }
    });
  });
  await worker.start();
  logger.info({ queue: QUEUE }, 'Processing observations from RabbitMQ');
}

/** Accepts an observation for processing and returns its id straight away. */
export async function submitObservation(observation: Observation): Promise<string> {
  const id = randomUUID();

  if (!worker) {
    await processAndPublish(id, observation);
    return id;
  }

  const ch = worker.channel;
  if (!ch) throw new HttpError(503, 'Processing queue unavailable, retry shortly');
  ch.sendToQueue(QUEUE, Buffer.from(JSON.stringify({ id, receivedAt: new Date().toISOString(), observation })), {
    persistent: true,
    contentType: 'application/json',
    messageId: id,
  });
  return id;
}

export async function stopObservationPipeline() {
  await worker?.stop();
  worker = null;
}
