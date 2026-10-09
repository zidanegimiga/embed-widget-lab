import type { Observation } from '../observation.schema.ts';

export function patientLabel({ patient }: Observation) {
  return `${patient.name} / MRN ${patient.mrn}`;
}

/** Context every result carries, after the processor's own details. */
export function contextDetails({ patient, recordedBy }: Observation) {
  return {
    ...(patient.ward && { Ward: patient.ward }),
    ...(recordedBy && { 'Recorded by': recordedBy }),
  };
}
