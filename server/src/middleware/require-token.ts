import type { RequestHandler } from 'express';
import { isTokenValid } from '../lib/access.ts';
import { HttpError } from '../lib/http-error.ts';

// EventSource and WebSocket cannot send custom headers, so streams pass the token in the
// query string. fetch() can, so GraphQL requests may use Authorization: Bearer instead.
export const requireToken: RequestHandler = (req, _res, next) => {
  const token = req.query.token ?? req.get('authorization')?.replace(/^Bearer\s+/i, '');
  next(isTokenValid(token) ? undefined : new HttpError(401, 'Invalid or missing token'));
};
