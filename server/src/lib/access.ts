import { timingSafeEqual } from 'node:crypto';
import { config } from '../config/env.ts';

// Shared by the HTTP (SSE) and WebSocket paths so both enforce the same rules.

export function isTokenValid(token: unknown): boolean {
  if (!config.WIDGET_TOKEN) return true;
  if (typeof token !== 'string') return false;
  const given = Buffer.from(token);
  const expected = Buffer.from(config.WIDGET_TOKEN);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export function isOriginAllowed(origin: string | undefined): boolean {
  const allowed = config.ALLOWED_ORIGINS;
  return allowed === '*' || (origin !== undefined && allowed.includes(origin));
}
