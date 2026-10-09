import type { RequestHandler } from 'express';
import { eventBus } from './event-bus.ts';
import { createEvent } from './event.schema.ts';
import { openSseStream } from './transports/sse.transport.ts';

export const streamEvents: RequestHandler = (req, res) => {
  openSseStream(req, res);
};

export const publishEvent: RequestHandler = (req, res) => {
  const event = createEvent(req.body);
  eventBus.publish(event);
  res.status(202).json(event);
};
