# Event server

Express 5 API that sits between the HMIS and the widget. The HMIS sends raw patient data in,
the server assesses it, and every connected widget receives the result in real time.

```
HMIS --POST /observations--> server --> RabbitMQ work queue --> processor --> result event
                                                                                   |
widgets <--WebSocket / SSE-- every server instance <-- RabbitMQ fanout <-----------+
widgets <--GraphQL (history)-- recent events kept by every instance
```

Written in TypeScript and run directly by Node 24 (type stripping), so there is no build step.
`tsc` only type-checks.

## Folder structure

```
server/
├── Dockerfile                  Production image (node:24-alpine, runs src/server.ts as-is)
├── .env.example                Every environment variable, with defaults and notes
├── package.json                Scripts: dev, start, test, typecheck, publish:event
├── vitest.config.ts            Test settings and env vars (see Testing)
├── tsconfig.json               Type-check only; enforces erasable syntax and .ts imports
└── src/
    ├── server.ts               Entry point: starts HTTP, WebSocket, RabbitMQ consumers; graceful shutdown
    ├── app.ts                  Builds the Express app (middleware + routers). No listen(), so it is testable
    │
    ├── config/
    │   └── env.ts              Reads process.env once, validates it with Zod, exports a frozen `config`
    │
    ├── lib/                    Shared infrastructure, no business logic
    │   ├── logger.ts           Pino logger singleton (pretty in dev, JSON in production)
    │   ├── rabbitmq.ts         One shared connection + createResilientChannel() that reconnects with backoff
    │   ├── access.ts           Token and API key checks (constant-time), origin allow-list
    │   └── http-error.ts       HttpError(status, message), turned into JSON by the error handler
    │
    ├── middleware/             Express middleware, one concern per file
    │   ├── require-token.ts    Widget token from ?token= (SSE/WS) or Authorization: Bearer (GraphQL)
    │   ├── require-api-key.ts  HMIS API key from Authorization: Bearer
    │   ├── rate-limit.ts       Per-IP limit on the ingest endpoints
    │   ├── not-found.ts        404 for unknown routes
    │   └── error-handler.ts    ZodError -> 400, HttpError -> its status, anything else -> 500
    │
    ├── modules/                Features. Each owns its schema, routes, controller and logic
    │   ├── observations/       Raw HMIS data in, assessed result out
    │   │   ├── observation.schema.ts     Zod schema for vitals and lab observations
    │   │   ├── reference-ranges.ts       Demo thresholds + assess(), shared by every processor
    │   │   ├── processors/
    │   │   │   ├── index.ts              processObservation(): picks the processor by kind
    │   │   │   ├── vitals.processor.ts   Flags each vital sign, builds the result event
    │   │   │   ├── lab.processor.ts      Compares a lab value with its reference range
    │   │   │   └── shared.ts             Patient label and context details used by all processors
    │   │   ├── observation.pipeline.ts   Durable RabbitMQ work queue (or inline when no broker)
    │   │   ├── observations.controller.ts
    │   │   └── observations.routes.ts    POST /observations
    │   │
    │   ├── graphql/            Read API for widgets
    │   │   ├── schema.ts                 SDL + resolvers: recentEvents as a Relay-style connection
    │   │   ├── graphql.routes.ts         GraphQL Yoga mounted at /graphql behind the widget token
    │   │   └── graphql.test.ts           Auth, pagination, filtering and error cases over HTTP
    │   │
    │   └── events/             Getting events to the widgets
    │       ├── event.schema.ts           Event shape, createEvent() and toEvent()
    │       ├── event-bus.ts              In-process pub/sub between producers and transports
    │       ├── event-history.ts          Last 200 events, newest first, paged by id
    │       ├── event-history.test.ts
    │       ├── producers/                Where events come from
    │       │   ├── producer.ts           EventProducer interface (start, stop, ingest)
    │       │   ├── rabbitmq.producer.ts  Consumes the fanout exchange, publishes ingested events to it
    │       │   ├── fake.producer.ts      Sample events for local dev without RabbitMQ
    │       │   └── index.ts              Picks a producer at startup; ingestEvent() routes through it
    │       ├── transports/               How events reach browsers
    │       │   ├── sse.transport.ts      Server-Sent Events stream with heartbeats
    │       │   └── ws.transport.ts       WebSocket server, auth during upgrade, dead-client cleanup
    │       ├── events.controller.ts
    │       └── events.routes.ts          GET /events (SSE), POST /events (ready-made events)
    │
    └── scripts/
        └── publish-event.ts    CLI: publish a test event straight to RabbitMQ
```

### How the layers depend on each other

```
server.ts ──> app.ts ──> modules/*/routes ──> controllers ──> pipeline / producers
                 │                                                    │
                 └──> middleware ──> lib <────────────────────────────┘
                                      │
                                      └──> config
```

`config` and `lib` never import from `modules`. Modules talk to each other only through exported
functions (`observations` calls `ingestEvent()` from `events`), never by reaching into internals.

## Endpoints

| Method | Path            | Auth                       | Purpose                                         |
|--------|-----------------|----------------------------|-------------------------------------------------|
| POST   | `/observations` | `Authorization: Bearer KEY` | HMIS sends raw vitals or lab results            |
| POST   | `/events`       | `Authorization: Bearer KEY` | HMIS sends a ready-made notification            |
| GET    | `/events`       | `?token=WIDGET_TOKEN`      | Widget subscribes over Server-Sent Events       |
| WS     | `/ws`           | `?token=WIDGET_TOKEN`      | Widget subscribes over WebSocket                |
| POST   | `/graphql`      | `Authorization: Bearer WIDGET_TOKEN` | Widget reads recent event history     |
| GET    | `/health`       | none                       | Health check                                    |

Both ingest POST endpoints are rate limited per IP and return `202` with an id.

## GraphQL

One query, shaped as a Relay connection so any GraphQL client (Relay, Apollo, urql) can page it:

```graphql
query RecentEvents($first: Int!, $after: String, $severity: Severity) {
  recentEvents(first: $first, after: $after, severity: $severity) {
    totalCount
    edges { cursor node { id type severity message patient source ts details { label value } } }
    pageInfo { hasNextPage endCursor }
  }
}
```

- `first` is 1 to 50 (default 20). Pass the previous page's `endCursor` as `after` for the next one.
- `severity` filters to `INFO`, `WARNING` or `CRITICAL`; `totalCount` counts only matching events.
- Cursors are opaque. One that has aged out of the history returns a clear error.
- History is in memory, per instance, last 200 events. Every instance receives every event via
  the RabbitMQ fanout, so instances agree on events since they started. A production system
  would store events in a database and resolve the query from there.
- In development, `GET /graphql` opens GraphiQL for exploring the schema.

## Running

From the repo root:

```bash
npm run dev            # server with fake events, plus widget and demo hosts
npm run docker:up      # production-like stack with RabbitMQ
```

From this folder:

```bash
npm run dev            # node --watch, reads .env if present
npm test               # Vitest
npm run typecheck
npm run publish:event -- "Code blue, Ward 2" critical
```

## Configuration

All settings are in `.env.example`. The important ones:

| Variable            | Purpose                                                          |
|---------------------|------------------------------------------------------------------|
| `RABBITMQ_URL`      | Broker URL. Unset in dev means fake events and inline processing |
| `WIDGET_TOKEN`      | Token widgets use to subscribe. Required in production           |
| `INGEST_API_KEY`    | Key the HMIS uses to post. Required in production                |
| `ALLOWED_ORIGINS`   | HMIS origins allowed to connect, comma separated                 |
| `TRUST_PROXY`       | Proxies in front of the server (1 on Render), for real client IPs |
| `INGEST_RATE_LIMIT` | Ingest requests per minute per IP (default 30)                   |

In production the server refuses to start without `WIDGET_TOKEN` and `INGEST_API_KEY`, never
generates fake events, and exits if RabbitMQ is still unreachable after 5 attempts (about 15s).

`LOG_LEVEL` accepts `error`, `warn`, `info`, `debug` or `trace`. GraphQL Yoga reads the same
variable and crashes at startup on anything else, so the config rejects other values up front.

## Testing

Vitest, with tests next to the code they cover (`*.test.ts`):

- `event-history.test.ts` covers ordering, cursor paging, severity filters and the 200-event cap.
- `graphql.test.ts` starts the real Express app on a random port and queries it over HTTP:
  token check, Relay connection shape, paging with `endCursor`, filtering, and error messages.

`vitest.config.ts` sets the env vars before any file loads (config is read once at import), and
aliases `graphql` to the build Node uses. graphql 17 ships a separate development build, and
without the alias Yoga and our resolvers would load different copies, masking every error.

## Conventions

- Import local files with the `.ts` extension. Use only erasable TypeScript (no enums, no
  parameter properties, no namespaces), because Node strips types without compiling.
- Validate every input with Zod at the edge. Throw `HttpError` for expected failures; the error
  handler formats the response.
- Never log secrets. The request logger redacts `token` from URLs and drops headers.
- New feature: add a folder under `modules/` with its schema, routes and controller, and mount
  the router in `app.ts`.
