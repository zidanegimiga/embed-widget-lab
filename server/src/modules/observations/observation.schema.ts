import { z } from 'zod';
import { LAB_TESTS, type LabTest } from './reference-ranges.ts';

const patientSchema = z.object({
  mrn: z.string().min(1).max(32),
  name: z.string().min(1).max(80),
  ward: z.string().max(40).optional(),
});

const common = {
  patient: patientSchema,
  source: z.string().max(80).optional(),
  recordedBy: z.string().max(80).optional(),
};

const vitalsSchema = z.object({
  ...common,
  kind: z.literal('vitals'),
  data: z
    .object({
      spo2: z.number().min(0).max(100).optional(),
      heartRate: z.number().min(0).max(300).optional(),
      respiratoryRate: z.number().min(0).max(80).optional(),
      temperature: z.number().min(25).max(45).optional(),
      systolicBp: z.number().min(0).max(300).optional(),
    })
    .refine((d) => Object.values(d).some((v) => v !== undefined), 'Provide at least one vital sign'),
});

const labSchema = z.object({
  ...common,
  kind: z.literal('lab'),
  data: z.object({
    test: z.enum(Object.keys(LAB_TESTS) as [LabTest, ...LabTest[]]),
    value: z.number(),
  }),
});

/** Raw patient data as entered in the HMIS. */
export const observationSchema = z.discriminatedUnion('kind', [vitalsSchema, labSchema]);

export type Observation = z.output<typeof observationSchema>;
export type VitalsObservation = z.output<typeof vitalsSchema>;
export type LabObservation = z.output<typeof labSchema>;
