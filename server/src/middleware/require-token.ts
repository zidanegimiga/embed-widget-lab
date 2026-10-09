import type { RequestHandler } from 'express';
import { isTokenValid } from '../lib/access.ts';
import { HttpError } from '../lib/http-error.ts';

// Token comes from the query string: EventSource and WebSocket cannot send custom headers.
export const requireToken: RequestHandler = (req, _res, next) => {
  next(isTokenValid(req.query.token) ? undefined : new HttpError(401, 'Invalid or missing token'));
};
