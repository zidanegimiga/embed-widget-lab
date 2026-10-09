import type { Server } from 'node:http';
import { WebSocket, WebSocketServer } from 'ws';
import { isOriginAllowed, isTokenValid } from '../../../lib/access.ts';
import { logger } from '../../../lib/logger.ts';
import { eventBus } from '../event-bus.ts';

const WS_PATH = '/ws';
const HEARTBEAT_MS = 30_000;

/** Attaches a WebSocket endpoint to an existing HTTP server and fans bus events out to it. */
export function attachWebSocketTransport(server: Server) {
  const wss = new WebSocketServer({ noServer: true });
  const alive = new WeakMap<WebSocket, boolean>();

  // Authenticate during the HTTP upgrade so rejected clients never get a socket.
  server.on('upgrade', (req, socket, head) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (url.pathname !== WS_PATH) return socket.destroy();

    if (!isOriginAllowed(req.headers.origin) || !isTokenValid(url.searchParams.get('token'))) {
      socket.end('HTTP/1.1 401 Unauthorized\r\n\r\n');
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
  });

  wss.on('connection', (ws) => {
    alive.set(ws, true);
    ws.on('pong', () => alive.set(ws, true));
    logger.debug({ clients: wss.clients.size }, 'WebSocket client connected');
  });

  const unsubscribe = eventBus.subscribe((event) => {
    const data = JSON.stringify(event);
    for (const client of wss.clients) {
      if (client.readyState === WebSocket.OPEN) client.send(data);
    }
  });

  // Drop clients that vanished without closing (sleeping laptops, dropped Wi-Fi).
  const heartbeat = setInterval(() => {
    for (const client of wss.clients) {
      if (!alive.get(client)) {
        client.terminate();
        continue;
      }
      alive.set(client, false);
      client.ping();
    }
  }, HEARTBEAT_MS);

  return {
    close() {
      clearInterval(heartbeat);
      unsubscribe();
      for (const client of wss.clients) client.close(1001, 'Server shutting down');
      wss.close();
    },
  };
}
