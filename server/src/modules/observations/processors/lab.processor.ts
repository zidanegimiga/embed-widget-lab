import type { EventInput } from '../../events/event.schema.ts';
import type { LabObservation } from '../observation.schema.ts';
import { assess, LAB_TESTS } from '../reference-ranges.ts';
import { contextDetails, patientLabel } from './shared.ts';

export function processLab(obs: LabObservation): EventInput {
  const range = LAB_TESTS[obs.data.test];
  const { value } = obs.data;
  const { flag, severity } = assess(value, range);
  const result = `${value} ${range.unit}`;

  return {
    type: 'lab.assessed',
    severity,
    message:
      flag === 'normal'
        ? `${range.label} ${result} is within range for ${obs.patient.name}`
        : `${range.label} ${result} is ${flag} for ${obs.patient.name}`,
    patient: patientLabel(obs),
    source: obs.source,
    details: {
      Test: range.label,
      Result: result,
      'Reference range': `${range.low} to ${range.high} ${range.unit}`,
      Flag: flag,
      ...contextDetails(obs),
    },
  };
}
