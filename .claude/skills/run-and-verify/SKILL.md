---
name: run-and-verify
description: How to run the embed-widget-lab stack locally and verify a change end to end (HMIS demo to server to RabbitMQ to widget). Use when asked to run, start, test or check the project, to send test events or observations, or when something in the local stack (Docker, ports, caching, RabbitMQ) misbehaves.
---

# Run and verify

## Two ways to run

| Command (repo root) | What runs                                                   | Use for                     |
|---------------------|-------------------------------------------------------------|-----------------------------|
| `npm run dev`       | Server (fake events every 4s, inline processing), widget watch build on :4100, demo on :5050 | UI work, quick iteration |
| `npm run docker:up` | RabbitMQ, server (`NODE_ENV=production`), widget, demo, all in Docker | End-to-end and production behaviour |

Both use the same ports (4000 server, 4100 widget, 5050 demo), so stop one before starting the
other (`npm run docker:down`, or Ctrl+C for dev).

In Docker mode there are **no fake events**. Something must send data:

```bash
npm run docker:publish -- "Code blue, Ward 2" critical      # straight into RabbitMQ
```

Or use the demo's "Record observation" panel, or post to the API (key is `INGEST_API_KEY`
in `.env`; never print it in chat):

```bash
curl -X POST localhost:4000/observations \
  -H "Authorization: Bearer $INGEST_API_KEY" -H "Content-Type: application/json" \
  -d '{"kind":"vitals","patient":{"mrn":"102215","name":"A. Mwangi","ward":"ICU"},"data":{"spo2":86}}'
```

## Verifying a change

1. Type-check: `npm run typecheck` (root, covers widget and server).
2. Rebuild only what changed: `docker compose up -d --build <server|widget|demo>`.
3. API: `curl localhost:4000/health`, then exercise the endpoint, including a bad payload
   (expect 400), no key (401) and, for ingest, more than `INGEST_RATE_LIMIT` posts (429).
4. Browser: open http://localhost:5050, confirm the widget dot is green and new data appears.
   Inspect the widget from the console through its shadow root:
   `document.getElementById('hmis-widget-host').shadowRoot.querySelectorAll('li')`.
5. Logs: `docker compose logs server | tail`. Tokens must appear as `[redacted]`.

## Known pitfalls

- **Stale JS or CSS after a rebuild.** The widget bundle is cached for 5 minutes by design.
  Bypass the cache (`fetch(url, { cache: 'reload' })` then reload) before concluding a fix
  failed. Verify the served file contains your change with `curl`.
- **Docker Desktop hangs** (`docker ps` never returns, builds sit at 0% CPU). Restarting Docker
  Desktop fixes it but stops every container on the machine, so ask the user first.
- **401 on the widget stream** usually means the page has an old `data-token`. The demo gets
  the token at build time; rebuild the demo after changing `WIDGET_TOKEN`.
- **RabbitMQ login refused.** `guest/guest` only works from localhost. Compose creates the user
  from `RABBITMQ_USER` / `RABBITMQ_PASSWORD` in `.env`.
- **Ports in use.** `lsof -nP -iTCP:4000 -iTCP:4100 -iTCP:5050 -sTCP:LISTEN` shows who holds them.
- **Smooth scrolling.** The demo uses `scroll-behavior: smooth`, so `window.scrollTo` in a test
  takes about a second to land.

## Before saying something works

State what was actually checked (typecheck, curl results, what appeared in the widget), and
what was not (for example "not tested against a real CloudAMQP instance").
