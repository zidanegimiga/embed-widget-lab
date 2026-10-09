import type { RequestHandler } from 'express';
import { submitObservation } from './observation.pipeline.ts';
import { observationSchema } from './observation.schema.ts';

export const receiveObservation: RequestHandler = async (req, res) => {
  const id = await submitObservation(observationSchema.parse(req.body));
  res.status(202).json({ id });
};
