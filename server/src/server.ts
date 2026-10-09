import { createServer, type Server } from 'node:http';
import { createApp } from './app.ts';
import { config } from './config/env.ts';
import { logger } from './lib/logger.ts';
import { closeRabbitMQ } from './lib/rabbitmq.ts';
import { startEventProducer } from './modules/events/producers/index.ts';
import { attachWebSocketTransport } from './modules/events/transports/ws.transport.ts';

const SHUTDOWN_TIMEOUT_MS = 10_000;

const apiServer = createServer(createApp());
const wsTransport = attachWebSocketTransport(apiServer);

function close(server: Server) {
  return new Promise<void>((resolve) => {
    server.close(() => resolve());
    server.closeAllConnections(); // SSE streams never end on their own
  });
}

await new Promise<void>((resolve) => apiServer.listen(config.PORT, resolve));
logger.info({ port: config.PORT }, 'Event server listening');
const producer = await startEventProducer();

let shuttingDown = false;
async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, 'Shutting down');
  setTimeout(() => process.exit(1), SHUTDOWN_TIMEOUT_MS).unref();

  await producer.stop();
  wsTransport.close();
  await close(apiServer);
  await closeRabbitMQ();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
