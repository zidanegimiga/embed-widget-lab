import type { EventInput } from '../../events/event.schema.ts';
import type { Observation } from '../observation.schema.ts';
import { processLab } from './lab.processor.ts';
import { processVitals } from './vitals.processor.ts';

/** Turns raw HMIS data into a result event. Add a processor per new observation kind. */
export function processObservation(obs: Observation): EventInput {
  switch (obs.kind) {
    case 'vitals':
      return processVitals(obs);
    case 'lab':
      return processLab(obs);
  }
}
