import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    // graphql 17 ships a separate development build. Vitest would resolve our imports to it,
    // while graphql-yoga (loaded by Node) uses the production build: two copies, so errors we
    // throw are not recognised as GraphQLError and get masked. Point both at the file Node uses.
    alias: [{ find: /^graphql$/, replacement: fileURLToPath(import.meta.resolve('graphql')) }],
  },
  test: {
    environment: 'node',
    // config/env.ts reads these once at import, so they are set before any test file loads.
    env: {
      NODE_ENV: 'test',
      LOG_LEVEL: 'error',
      WIDGET_TOKEN: 'test-widget-token',
      INGEST_API_KEY: 'test-ingest-key-0123',
    },
  },
});
