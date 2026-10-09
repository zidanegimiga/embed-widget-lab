import type { RequestHandler } from 'express';
import { isApiKeyValid } from '../lib/access.ts';
import { HttpError } from '../lib/http-error.ts';

// Expects: Authorization: Bearer <INGEST_API_KEY>
export const requireApiKey: RequestHandler = (req, _res, next) => {
  const key = req.get('authorization')?.replace(/^Bearer\s+/i, '');
  next(isApiKeyValid(key) ? undefined : new HttpError(401, 'Invalid or missing API key'));
};
