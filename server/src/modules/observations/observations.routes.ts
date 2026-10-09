import { Router } from 'express';
import { ingestRateLimit } from '../../middleware/rate-limit.ts';
import { requireApiKey } from '../../middleware/require-api-key.ts';
import { receiveObservation } from './observations.controller.ts';

export const observationsRouter = Router();

// The HMIS sends raw patient data; the server assesses it and streams the result to widgets.
observationsRouter.post('/observations', ingestRateLimit, requireApiKey, receiveObservation);
