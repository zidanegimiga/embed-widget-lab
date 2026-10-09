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
  INGEST_API_KEY: z.string().min(16).optional(),
  RABBITMQ_URL: z.url().optional(),
  RABBITMQ_EXCHANGE: z.string().default('hmis.events'),
  FAKE_EVENT_INTERVAL_MS: z.coerce.number().int().positive().default(4000),
}).superRefine((env, ctx) => {
  if (env.NODE_ENV !== 'production') return;
  for (const key of ['WIDGET_TOKEN', 'INGEST_API_KEY'] as const) {
    if (!env[key]) ctx.addIssue({ code: 'custom', path: [key], message: 'Required in production' });
  }
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
