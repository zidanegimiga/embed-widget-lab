# embed-widget-lab

Experiment: a draggable React widget that any site can embed with one script tag,
floating above the host page and streaming events over WebSocket or SSE,
with RabbitMQ as the upstream source.

## Pieces

Each piece deploys on its own and talks to the others only over URLs:

| Piece    | What                                  | Local port | Deploys to                               |
|----------|---------------------------------------|------------|------------------------------------------|
| widget   | static `widget.js` / `widget.mjs`     | 4100       | any CDN or static host (nginx image)     |
| server   | Express event API, WebSocket + SSE    | 4000       | any container host                       |
| rabbitmq | message broker                        | 5672       | container, or managed (e.g. CloudAMQP)   |
| demo     | stand-in for a customer HMIS          | 5050       | anywhere; it only pastes the script tag  |

The HMIS is never ours. All it adds is:

    <script src="https://WIDGET_HOST/widget.js" data-token="..." async></script>

`data-url` is optional when the widget was built with `VITE_SERVER_URL`.

## Run with Docker (production-like)

    cp .env.example .env      # set real secrets and URLs
    npm run docker:up
    npm run docker:publish -- "Code blue, Ward 2" critical

Open http://localhost:5050. The server runs with NODE_ENV=production: no fake events,
token, API key and origin checks on. RabbitMQ UI: http://localhost:15672.

## Sending patient data from the HMIS

The HMIS sends raw patient data. The server assesses it and streams the result to the widgets:

    HMIS --POST /observations--> server --> RabbitMQ work queue (durable) --> processor
         --> result event --> RabbitMQ fanout --> every server instance --WS/SSE--> widgets

    curl -X POST https://your-server/observations \
      -H "Authorization: Bearer $INGEST_API_KEY" \
      -H "Content-Type: application/json" \
      -d '{
        "kind": "vitals",
        "patient": { "mrn": "102215", "name": "A. Mwangi", "ward": "ICU" },
        "source": "CityCare HMIS",
        "recordedBy": "Nurse Achieng",
        "data": { "spo2": 86, "heartRate": 132, "temperature": 37.1 }
      }'

Observation kinds:

| kind     | data                                                                         |
|----------|------------------------------------------------------------------------------|
| `vitals` | any of `spo2`, `heartRate`, `respiratoryRate`, `temperature`, `systolicBp`   |
| `lab`    | `test` (`potassium`, `sodium`, `glucose`, `hemoglobin`, `creatinine`), `value` |

The server replies `202` with an observation id straight away. Processing happens off the
durable queue, so observations survive a restart and any instance can process them. Each
processor compares values with the ranges in `reference-ranges.ts` and produces an event
such as "Abnormal vitals for P. Otieno: SpO2 low, Heart rate high", with the readings in
`details`. Those thresholds are demo values, not clinical guidance.

To add a new kind of observation: add its schema in `observation.schema.ts`, write a
processor in `processors/`, and add one `case` in `processors/index.ts`.

In the demo, the "Record observation" panel sends these from `demo/hmis-integration.js`.
It calls the API from the browser only because the demo has no backend. A real HMIS calls
it from its server, so the API key never reaches a browser.

### Ready-made notifications

For messages that need no processing, the HMIS can post an event directly:

    curl -X POST https://your-server/events \
      -H "Authorization: Bearer $INGEST_API_KEY" \
      -H "Content-Type: application/json" \
      -d '{ "type": "bed.status", "severity": "info", "message": "Bed 12, ICU now available" }'

## Run without Docker (development)

    npm install
    npm run dev               # server (fake events), widget watch build, widget host, demo host

## Deploying for real

1. RabbitMQ: create a dedicated user (guest/guest only works from localhost).
2. Server: set `RABBITMQ_URL`, `WIDGET_TOKEN`, `INGEST_API_KEY`, `ALLOWED_ORIGINS` (the HMIS origins),
   `NODE_ENV=production`.
   Put it behind HTTPS so the widget connects with `wss://` and `https://`.
3. Widget: build with `VITE_SERVER_URL=https://your-server`, upload `widget/dist` to a CDN.
4. HMIS: paste the script tag with its token, and call `POST /observations` from its backend with the API key.

Type-check both packages: `npm run typecheck`

## Security

What the server enforces in production:

- `ALLOWED_ORIGINS` limits which HMIS sites can connect. WebSocket upgrades from other origins get a 401,
  and SSE responses carry no CORS header for them, so the browser blocks them.
- `WIDGET_TOKEN` is checked on both transports, during the WebSocket handshake and on `GET /events`.
- Tokens are redacted from request logs, and request headers are not logged.
- `POST /observations` and `POST /events` require `INGEST_API_KEY` as a Bearer token. The server refuses to start in production
  without `INGEST_API_KEY` and `WIDGET_TOKEN`.
- No fake events. If RabbitMQ is unreachable at startup, the server refuses to start
  instead of serving made-up clinical data.
- If RabbitMQ restarts, the server reconnects with backoff and the widgets keep their connections.

Known limitation, to fix before real hospitals use this: the token is written into the HMIS page,
so anyone who views the page source can copy it. It identifies the embedding site, not the person
using it, and cannot limit what they see.

The planned fix is per-user signed tokens:

1. The HMIS backend issues a short-lived signed token (for example a JWT) naming the tenant, user,
   role and active visit.
2. The widget sends it when connecting, and the server verifies the signature and expiry.
3. The server only forwards events that match the token's tenant, role and visit, and the widget
   requests a new token when the user switches patient or visit.

## Server layout

    server/src/
      server.ts              entry: starts HTTP server, WebSocket, producer; graceful shutdown
      app.ts                 builds the Express app (no listen, so it stays testable)
      config/env.ts          env vars validated with Zod once, exported as a frozen singleton
      lib/                   shared infrastructure: logger, RabbitMQ connection, access rules, HttpError
      middleware/            require-token, not-found, error-handler
      modules/
        observations/
          observation.schema.ts   raw HMIS data (vitals, lab), validated with Zod
          reference-ranges.ts     demo thresholds and one assess() rule shared by all processors
          processors/             one processor per observation kind, raw data to result event
          observation.pipeline.ts durable work queue in RabbitMQ, inline processing without a broker
          observations.routes.ts  POST /observations (API key)
        events/
          event.schema.ts    event shape + createEvent()
          event-bus.ts       in-process pub/sub singleton between producers and transports
          events.routes.ts   GET /events (SSE, widget token), POST /events (ingest, API key)
          events.controller.ts
          producers/         where events come from: rabbitmq, fake (behind one interface)
          transports/        how events reach browsers: ws, sse
      scripts/publish-event.ts

Producers only publish to the bus and transports only subscribe to it, so adding Kafka or a
new transport means adding one file without touching the others.

## Embed

Script tag (any site):

    <script src="https://cdn.example.com/widget.js"
            data-url="https://events.example.com" data-transport="ws" data-token="..." async></script>

npm (bundled apps):

    import { init, destroy } from '@lab/hmis-widget';
    init({ url: 'https://events.example.com', transport: 'sse' });

## How it works

- Vite library mode builds `widget.js` (IIFE, React bundled, exposes `window.HMISWidget`) and `widget.mjs` (ESM).
- `init()` appends a fixed, full-viewport host div with `pointer-events: none`, attaches a Shadow DOM,
  injects the CSS into it, and renders React there. The host page stays clickable; its CSS cannot reach the widget.
- Dragging uses pointer events with pointer capture, clamped to the viewport, saved to localStorage.
- Browsers cannot speak AMQP, so RabbitMQ stays server side. The Node server consumes an exclusive queue bound
  to a fanout exchange and fans out to browsers over WebSocket (`/ws`) and SSE (`/events`).
