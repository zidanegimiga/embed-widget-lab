# Event server

Express 5 API that sits between the HMIS and the widget. The HMIS sends raw patient data in,
the server assesses it, and every connected widget receives the result in real time.

```
HMIS --POST /observations--> server --> RabbitMQ work queue --> processor --> result event
                                                                                   |
widgets <--WebSocket / SSE-- every server instance <-- RabbitMQ fanout <-----------+
```

Written in TypeScript and run directly by Node 24 (type stripping), so there is no build step.
`tsc` only type-checks.

## Folder structure

```
server/
├── Dockerfile                  Production image (node:24-alpine, runs src/server.ts as-is)
├── .env.example                Every environment variable, with defaults and notes
├── package.json                Scripts: dev, start, typecheck, publish:event
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
    │   ├── require-token.ts    Widget token from ?token= (browsers cannot set headers on SSE/WS)
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
    │   └── events/             Getting events to the widgets
    │       ├── event.schema.ts           Event shape, createEvent() and toEvent()
    │       ├── event-bus.ts              In-process pub/sub between producers and transports
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
| GET    | `/health`       | none                       | Health check                                    |

Both POST endpoints are rate limited per IP and return `202` with an id.

## Running

From the repo root:

```bash
npm run dev            # server with fake events, plus widget and demo hosts
npm run docker:up      # production-like stack with RabbitMQ
```

From this folder:

```bash
npm run dev            # node --watch, reads .env if present
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
generates fake events, and refuses to start if RabbitMQ is unreachable.

## Conventions

- Import local files with the `.ts` extension. Use only erasable TypeScript (no enums, no
  parameter properties, no namespaces), because Node strips types without compiling.
- Validate every input with Zod at the edge. Throw `HttpError` for expected failures; the error
  handler formats the response.
- Never log secrets. The request logger redacts `token` from URLs and drops headers.
- New feature: add a folder under `modules/` with its schema, routes and controller, and mount
  the router in `app.ts`.
