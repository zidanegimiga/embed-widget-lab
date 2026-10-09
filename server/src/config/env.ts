import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  ALLOWED_ORIGINS: z
    .string()
    .default('*')
    .transform((value) => (value === '*' ? '*' : value.split(',').map((o) => o.trim()))),
  WIDGET_TOKEN: z.string().min(1).optional(),
  RABBITMQ_URL: z.url().optional(),
  RABBITMQ_EXCHANGE: z.string().default('hmis.events'),
  FAKE_EVENT_INTERVAL_MS: z.coerce.number().int().positive().default(4000),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment configuration:\n' + z.prettifyError(parsed.error));
  process.exit(1);
}

/** Validated once at startup, then shared as a read-only singleton. */
export const config = Object.freeze({
  ...parsed.data,
  isProduction: parsed.data.NODE_ENV === 'production',
});
