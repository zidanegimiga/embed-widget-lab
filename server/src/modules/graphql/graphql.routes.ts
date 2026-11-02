import { Router } from 'express';
import { createYoga } from 'graphql-yoga';
import { config } from '../../config/env.ts';
import { requireToken } from '../../middleware/require-token.ts';
import { schema } from './schema.ts';

const yoga = createYoga({
  schema,
  graphqlEndpoint: '/graphql',
  graphiql: !config.isProduction, // in-browser explorer for local development only
  landingPage: false,
  cors: false, // handled once for the whole app in app.ts
  logging: false, // requests are already logged by pino-http
});

export const graphqlRouter = Router();

// Read-only API for widgets, so it uses the widget token (Authorization header or ?token=).
graphqlRouter.use(yoga.graphqlEndpoint, requireToken, yoga);
