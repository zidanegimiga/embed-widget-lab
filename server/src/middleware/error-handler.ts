import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';

export const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
  // Streams (SSE) have already sent headers; let Express close the socket.
  if (res.headersSent) return next(err);

  if (err instanceof ZodError) {
    res.status(400).json({ error: 'Validation failed', issues: err.issues });
    return;
  }

  // Covers HttpError and body-parser errors (bad JSON, payload too large).
  const status: number = err.status ?? err.statusCode ?? 500;
  if (status >= 500) req.log.error({ err }, 'Unhandled error');

  res.status(status).json({ error: status >= 500 ? 'Internal Server Error' : err.message });
};
