import type { EventInput } from '../../events/event.schema.ts';
import type { VitalsObservation } from '../observation.schema.ts';
import { assess, formatReading, VITAL_SIGNS, worstSeverity, type VitalSign } from '../reference-ranges.ts';
import { contextDetails, patientLabel } from './shared.ts';

export function processVitals(obs: VitalsObservation): EventInput {
  const readings = (Object.entries(obs.data) as [VitalSign, number | undefined][])
    .filter((entry): entry is [VitalSign, number] => entry[1] !== undefined)
    .map(([sign, value]) => {
      const range = VITAL_SIGNS[sign];
      return { range, value, ...assess(value, range) };
    });

  const severity = worstSeverity(readings.map((r) => r.severity));
  const abnormal = readings.filter((r) => r.flag !== 'normal');
  const name = obs.patient.name;

  const message = abnormal.length
    ? `${severity === 'critical' ? 'Critical' : 'Abnormal'} vitals for ${name}: ` +
      abnormal.map((r) => `${r.range.label} ${r.flag}`).join(', ')
    : `Vitals within normal range for ${name}`;

  return {
    type: 'vitals.assessed',
    severity,
    message,
    patient: patientLabel(obs),
    source: obs.source,
    details: {
      ...Object.fromEntries(readings.map((r) => [r.range.label, formatReading(r.value, r.range, r.flag)])),
      ...contextDetails(obs),
    },
  };
}
