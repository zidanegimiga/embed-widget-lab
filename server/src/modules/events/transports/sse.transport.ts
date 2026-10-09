import type { Request, Response } from 'express';
import { eventBus } from '../event-bus.ts';

const HEARTBEAT_MS = 25_000; // under typical proxy idle timeouts

export function openSseStream(req: Request, res: Response) {
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no', // stop nginx from buffering the stream
  });
  res.flushHeaders();
  res.write('retry: 3000\n\n');

  const unsubscribe = eventBus.subscribe((event) => {
    res.write(`id: ${event.id}\nevent: hmis\ndata: ${JSON.stringify(event)}\n\n`);
  });
  const heartbeat = setInterval(() => res.write(': ping\n\n'), HEARTBEAT_MS);

  req.on('close', () => {
    clearInterval(heartbeat);
    unsubscribe();
  });
}
