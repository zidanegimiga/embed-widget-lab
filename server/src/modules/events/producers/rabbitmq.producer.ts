import type { Channel } from 'amqplib';
import { config } from '../../../config/env.ts';
import { HttpError } from '../../../lib/http-error.ts';
import { logger } from '../../../lib/logger.ts';
import { openExchangeChannel } from '../../../lib/rabbitmq.ts';
import { eventBus } from '../event-bus.ts';
import { toEvent } from '../event.schema.ts';
import type { EventProducer } from './producer.ts';

const MAX_RECONNECT_DELAY_MS = 30_000;

export function createRabbitMQProducer(): EventProducer {
  let channel: Channel | null = null;
  let reconnectTimer: NodeJS.Timeout | undefined;
  let stopping = false;

  async function connect() {
    const ch = await openExchangeChannel();
    channel = ch;
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

    // Fires on broker restarts and network drops, not only on our own stop().
    ch.on('close', () => {
      channel = null;
      if (!stopping) scheduleReconnect(0);
    });
  }

  function scheduleReconnect(attempt: number) {
    const delay = Math.min(1000 * 2 ** attempt, MAX_RECONNECT_DELAY_MS);
    logger.warn({ delay }, 'RabbitMQ channel closed, reconnecting');
    reconnectTimer = setTimeout(() => {
      connect().then(
        () => logger.info('Reconnected to RabbitMQ'),
        () => scheduleReconnect(attempt + 1),
      );
    }, delay);
  }

  return {
    name: 'rabbitmq',
    start: connect, // first failure is thrown so startup can decide what to do

    // Publish to the exchange rather than the local bus, so every server instance
    // (and every widget connected to any of them) receives it.
    async ingest(event) {
      if (!channel) throw new HttpError(503, 'Event broker unavailable, retry shortly');
      channel.publish(config.RABBITMQ_EXCHANGE, '', Buffer.from(JSON.stringify(event)), {
        contentType: 'application/json',
        messageId: event.id,
      });
    },
    async stop() {
      stopping = true;
      clearTimeout(reconnectTimer);
      await channel?.close().catch(() => {});
      channel = null;
    },
  };
}
