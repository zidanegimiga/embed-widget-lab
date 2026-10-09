import { rateLimit } from 'express-rate-limit';
import { config } from '../config/env.ts';
import { HttpError } from '../lib/http-error.ts';

// Runs before the API key check, so guessing keys is throttled too.
// The demo page exposes its key publicly, so this is what keeps it harmless.
export const ingestRateLimit = rateLimit({
  windowMs: 60_000,
  limit: config.INGEST_RATE_LIMIT,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: (_req, _res, next) => next(new HttpError(429, 'Too many requests, try again in a minute')),
});
