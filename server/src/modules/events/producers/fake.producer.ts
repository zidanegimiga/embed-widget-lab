import { eventBus } from '../event-bus.ts';
import { createEvent, type EventInput } from '../event.schema.ts';
import type { EventProducer } from './producer.ts';

const SAMPLES: EventInput[] = [
  { type: 'patient.admitted', severity: 'info', message: 'Admitted to Ward 3B', patient: 'MRN 104233 / J. Wanjiru' },
  { type: 'lab.result', severity: 'warning', message: 'Potassium 5.8 mmol/L (high)', patient: 'MRN 100871 / P. Otieno' },
  { type: 'alert.critical', severity: 'critical', message: 'SpO2 dropped to 86%', patient: 'MRN 102215 / A. Mwangi' },
  { type: 'bed.status', severity: 'info', message: 'Bed 12, ICU now available' },
  { type: 'order.pending', severity: 'warning', message: 'Medication order awaiting sign-off', patient: 'MRN 109932 / K. Njoroge' },
];

export function createFakeProducer(intervalMs: number): EventProducer {
  let timer: NodeJS.Timeout | undefined;

  return {
    name: 'fake',
    async start() {
      timer = setInterval(() => {
        eventBus.publish(createEvent(SAMPLES[Math.floor(Math.random() * SAMPLES.length)]));
      }, intervalMs);
    },
    async stop() {
      clearInterval(timer);
    },
  };
}
