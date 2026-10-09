import type { RequestHandler } from 'express';
import { createEvent } from './event.schema.ts';
import { ingestEvent } from './producers/index.ts';
import { openSseStream } from './transports/sse.transport.ts';

export const streamEvents: RequestHandler = (req, res) => {
  openSseStream(req, res);
};

export const receiveEvent: RequestHandler = async (req, res) => {
  const event = createEvent(req.body);
  await ingestEvent(event);
  res.status(202).json({ id: event.id, ts: event.ts });
};
