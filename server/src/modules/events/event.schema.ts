import { randomUUID } from 'node:crypto';
import { z } from 'zod';

const MAX_DETAILS = 8;

/** What the HMIS (or any producer) sends. */
export const eventInputSchema = z.object({
  type: z.string().min(1).max(64).default('custom'),
  severity: z.enum(['info', 'warning', 'critical']).default('info'),
  message: z.string().max(500).default(''),
  patient: z.string().max(120).optional(),
  /** Which system sent it, e.g. "CityCare HMIS". */
  source: z.string().max(80).optional(),
  /** A few labelled facts shown under the message, e.g. { Ward: "3B" }. */
  details: z
    .record(z.string().min(1).max(40), z.union([z.string().max(200), z.number()]))
    .refine((d) => Object.keys(d).length <= MAX_DETAILS, `At most ${MAX_DETAILS} details`)
    .optional(),
});

/** A stamped event, as it travels through RabbitMQ and out to widgets. */
export const hmisEventSchema = eventInputSchema.extend({
  id: z.uuid(),
  ts: z.iso.datetime(),
});

export type EventInput = z.input<typeof eventInputSchema>;
export type HmisEvent = z.output<typeof hmisEventSchema>;

/** Validates raw input and stamps it with an id and timestamp. Throws ZodError if invalid. */
export function createEvent(input: unknown): HmisEvent {
  return { id: randomUUID(), ts: new Date().toISOString(), ...eventInputSchema.parse(input) };
}

/** Accepts an already stamped event (from our ingest API) or bare input (from other publishers). */
export function toEvent(raw: unknown): HmisEvent {
  const stamped = hmisEventSchema.safeParse(raw);
  return stamped.success ? stamped.data : createEvent(raw);
}
