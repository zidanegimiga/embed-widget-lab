import { timingSafeEqual } from 'node:crypto';
import { config } from '../config/env.ts';

// Shared by the HTTP (SSE) and WebSocket paths so both enforce the same rules.

/** Constant-time compare, so response timing does not leak how much of a secret matched. */
function matchesSecret(given: unknown, secret: string | undefined): boolean {
  if (!secret) return true; // unset only in development; config requires it in production
  if (typeof given !== 'string') return false;
  const a = Buffer.from(given);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Browser-side token used by widgets to subscribe. */
export function isTokenValid(token: unknown): boolean {
  return matchesSecret(token, config.WIDGET_TOKEN);
}

/** Server-to-server key the HMIS uses to push events in. */
export function isApiKeyValid(key: unknown): boolean {
  return matchesSecret(key, config.INGEST_API_KEY);
}

export function isOriginAllowed(origin: string | undefined): boolean {
  const allowed = config.ALLOWED_ORIGINS;
  return allowed === '*' || (origin !== undefined && allowed.includes(origin));
}
