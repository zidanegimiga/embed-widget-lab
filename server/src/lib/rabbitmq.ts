import amqp from 'amqplib';
import { config } from '../config/env.ts';
import { logger } from './logger.ts';

type Connection = Awaited<ReturnType<typeof amqp.connect>>;

// One connection per process, created lazily and shared. Channels are cheap; connections are not.
let connection: Promise<Connection> | null = null;

function getConnection(): Promise<Connection> {
  if (!config.RABBITMQ_URL) return Promise.reject(new Error('RABBITMQ_URL is not set'));

  connection ??= amqp.connect(config.RABBITMQ_URL).then(
    (conn) => {
      conn.on('error', (err) => logger.error({ err }, 'RabbitMQ connection error'));
      conn.on('close', () => (connection = null));
      return conn;
    },
    (err) => {
      connection = null;
      throw err;
    },
  );
  return connection;
}

/** Opens a channel with the events exchange already declared. */
export async function openExchangeChannel() {
  const channel = await (await getConnection()).createChannel();
  await channel.assertExchange(config.RABBITMQ_EXCHANGE, 'fanout', { durable: false });
  return channel;
}

export async function closeRabbitMQ() {
  const conn = await connection?.catch(() => null);
  connection = null;
  await conn?.close();
}
