import { Router } from 'express';
import { requireApiKey } from '../../middleware/require-api-key.ts';
import { requireToken } from '../../middleware/require-token.ts';
import { receiveEvent, streamEvents } from './events.controller.ts';

export const eventsRouter = Router();

// Widgets subscribe (browser token).
eventsRouter.get('/events', requireToken, streamEvents);

// The HMIS pushes events in (server-to-server API key).
eventsRouter.post('/events', requireApiKey, receiveEvent);
