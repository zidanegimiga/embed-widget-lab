import { config } from '../../../config/env.ts';
import { HttpError } from '../../../lib/http-error.ts';
import { logger } from '../../../lib/logger.ts';
import { createResilientChannel } from '../../../lib/rabbitmq.ts';
import { eventBus } from '../event-bus.ts';
import { toEvent } from '../event.schema.ts';
import type { EventProducer } from './producer.ts';

export function createRabbitMQProducer(): EventProducer {
  const resilient = createResilientChannel('events', async (ch) => {
    await ch.assertExchange(config.RABBITMQ_EXCHANGE, 'fanout', { durable: false });
    // Exclusive, auto-deleted queue per instance: every server instance gets every event.
    const { queue } = await ch.assertQueue('', { exclusive: true });
    await ch.bindQueue(queue, config.RABBITMQ_EXCHANGE, '');

    await ch.consume(queue, (msg) => {
      if (!msg) return;
      try {
        eventBus.publish(toEvent(JSON.parse(msg.content.toString())));
        ch.ack(msg);
      } catch (err) {
        logger.warn({ err }, 'Dropping malformed RabbitMQ message');
        ch.nack(msg, false, false); // do not requeue, it will never parse
      }
    });
  });

  return {
    name: 'rabbitmq',
    start: resilient.start,
    stop: resilient.stop,

    // Publish to the exchange rather than the local bus, so every server instance
    // (and every widget connected to any of them) receives it.
    async ingest(event) {
      const ch = resilient.channel;
      if (!ch) throw new HttpError(503, 'Event broker unavailable, retry shortly');
      ch.publish(config.RABBITMQ_EXCHANGE, '', Buffer.from(JSON.stringify(event)), {
        contentType: 'application/json',
        messageId: event.id,
      });
    },
  };
}
