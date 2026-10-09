import amqp, { type Channel } from 'amqplib';
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

const MAX_RECONNECT_DELAY_MS = 30_000;

/**
 * A channel that rebuilds itself after broker restarts or network drops.
 * `setup` declares queues/exchanges and starts consumers; it runs on every (re)connect.
 */
export function createResilientChannel(name: string, setup: (channel: Channel) => Promise<void>) {
  let channel: Channel | null = null;
  let reconnectTimer: NodeJS.Timeout | undefined;
  let stopping = false;

  async function connect() {
    const ch = await (await getConnection()).createChannel();
    ch.on('close', () => {
      channel = null;
      if (!stopping) scheduleReconnect(0);
    });
    await setup(ch);
    channel = ch;
  }

  function scheduleReconnect(attempt: number) {
    const delay = Math.min(1000 * 2 ** attempt, MAX_RECONNECT_DELAY_MS);
    logger.warn({ channel: name, delay }, 'RabbitMQ channel closed, reconnecting');
    reconnectTimer = setTimeout(() => {
      connect().then(
        () => logger.info({ channel: name }, 'Reconnected to RabbitMQ'),
        () => scheduleReconnect(attempt + 1),
      );
    }, delay);
  }

  return {
    /** First failure is thrown so startup can decide what to do. */
    start: connect,
    /** Null while disconnected. */
    get channel() {
      return channel;
    },
    async stop() {
      stopping = true;
      clearTimeout(reconnectTimer);
      await channel?.close().catch(() => {});
      channel = null;
    },
  };
}

export async function closeRabbitMQ() {
  const conn = await connection?.catch(() => null);
  connection = null;
  await conn?.close();
}
