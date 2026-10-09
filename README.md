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

## Deploy for free

| Piece    | Host                         | Free plan notes                                                    |
|----------|------------------------------|--------------------------------------------------------------------|
| RabbitMQ | CloudAMQP                    | shared instance, enough for a demo                                 |
| server   | Render (Docker, `render.yaml`) | sleeps when idle; the first request after that is slow while it wakes |
| widget   | Cloudflare Pages             | global CDN, headers from `widget/public/_headers`                  |
| demo     | Cloudflare Pages (separate project) | its own domain, so the embed is genuinely cross-site       |

While the server sleeps, widgets show as disconnected and reconnect on their own once it wakes.
Observations sent in the meantime wait in the durable RabbitMQ queue and are processed on wake.
Free plans change, so check each provider's current limits.

### 1. RabbitMQ on CloudAMQP

Create a free instance and copy its AMQP URL (`amqps://...`).

### 2. Server on Render

1. Push the repo to GitHub.
2. In Render: **New > Blueprint**, pick the repo. It reads `render.yaml`.
3. Fill in `RABBITMQ_URL` with the CloudAMQP URL. Set `ALLOWED_ORIGINS` to a placeholder such as
   `https://example.com` for now (you will know the demo URL in step 4).
4. After the first deploy, note the service URL (e.g. `https://hmis-widget-api.onrender.com`)
   and copy the generated `WIDGET_TOKEN` and `INGEST_API_KEY` from its Environment tab.
5. Check `https://<service>/health` returns `{"status":"ok"}`.

### 3. Widget on Cloudflare Pages

Create a Pages project from the repo:

| Setting               | Value                                   |
|-----------------------|-----------------------------------------|
| Build command         | `npm ci && npm run build -w widget`     |
| Build output directory| `widget/dist`                           |
| Environment variables | `VITE_SERVER_URL` = the Render URL      |

The Node version comes from `.nvmrc`. Check `https://<widget>.pages.dev/widget.js` loads.

### 4. Demo on Cloudflare Pages

Create a second Pages project from the same repo:

| Setting               | Value                                                        |
|-----------------------|--------------------------------------------------------------|
| Build command         | `node demo/build.mjs`                                        |
| Build output directory| `demo/dist`                                                  |
| Environment variables | `WIDGET_URL`, `SERVER_URL`, `WIDGET_TOKEN`, `INGEST_API_KEY` |

### 5. Connect them

In Render, set `ALLOWED_ORIGINS` to the demo URL (e.g. `https://citycare-demo.pages.dev`,
no trailing slash) and save. Render redeploys. Open the demo, record an observation, and it
appears in the widget.

### Notes

- The demo's `INGEST_API_KEY` is visible in its page source. The ingest endpoints are rate limited
  per IP (`INGEST_RATE_LIMIT`, default 30 per minute), and you can rotate the key in Render and
  Pages at any time. A real HMIS keeps its key on its server.
- Rotating `WIDGET_TOKEN` or `INGEST_API_KEY` means updating Render and the demo project, then
  redeploying the demo.

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

## Repository layout

```
embed-widget-lab/
├── server/               Event API (Express, TypeScript). See server/README.md
├── widget/               Embeddable React widget. See widget/README.md
├── demo/                 CityCare, a stand-in HMIS that embeds the widget. See demo/README.md
├── .claude/skills/       Claude Code skills: project conventions for AI-assisted changes
├── docker-compose.yml    All four services (rabbitmq, server, widget, demo) on separate origins
├── render.yaml           Render Blueprint for deploying the server
├── .env.example          Secrets and URLs for docker compose
├── .nvmrc                Node version for Cloudflare Pages builds
└── package.json          npm workspaces (server, widget) and root scripts
```

Each package README has its own annotated folder tree and explains what every folder is for.

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
