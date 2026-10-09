import { randomUUID } from 'node:crypto';
import { z } from 'zod';

/** What producers send (RabbitMQ messages, POST /publish). */
export const eventInputSchema = z.object({
  type: z.string().min(1).default('custom'),
  severity: z.enum(['info', 'warning', 'critical']).default('info'),
  message: z.string().default(''),
  patient: z.string().optional(),
});

export type EventInput = z.input<typeof eventInputSchema>;
export type HmisEvent = z.output<typeof eventInputSchema> & { id: string; ts: string };

/** Validates raw input and stamps it with an id and timestamp. Throws ZodError if invalid. */
export function createEvent(input: unknown): HmisEvent {
  return { id: randomUUID(), ts: new Date().toISOString(), ...eventInputSchema.parse(input) };
}
