import { Router } from 'express';
import { config } from '../../config/env.ts';
import { requireToken } from '../../middleware/require-token.ts';
import { publishEvent, streamEvents } from './events.controller.ts';

export const eventsRouter = Router();

eventsRouter.get('/events', requireToken, streamEvents);

// Manual test hook. Real events come from RabbitMQ, so this stays out of production.
if (!config.isProduction) {
  eventsRouter.post('/publish', publishEvent);
}
