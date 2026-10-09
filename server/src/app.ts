import cors from 'cors';
import express from 'express';
import { pinoHttp } from 'pino-http';
import { config } from './config/env.ts';
import { logger } from './lib/logger.ts';
import { errorHandler } from './middleware/error-handler.ts';
import { notFound } from './middleware/not-found.ts';
import { eventsRouter } from './modules/events/events.routes.ts';

/** Event API. Kept free of listen() so it can be tested with supertest. */
export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.use(
    pinoHttp({
      logger,
      autoLogging: { ignore: (req) => req.url === '/health' },
      serializers: {
        // Tokens travel in the query string, so keep them out of the logs.
        req: (req) => ({
          id: req.id,
          method: req.method,
          url: req.url.replace(/([?&]token=)[^&]*/, '$1[redacted]'),
          origin: req.headers.origin,
        }),
        res: (res) => ({ statusCode: res.statusCode }),
      },
    }),
  );
  app.use(cors({ origin: config.ALLOWED_ORIGINS }));
  app.use(express.json({ limit: '16kb' }));

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });
  app.use(eventsRouter);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
