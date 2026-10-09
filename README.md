# embed-widget-lab

Experiment: a draggable React widget that any site can embed with one script tag,
floating above the host page and streaming events over WebSocket or SSE,
with RabbitMQ as the upstream source.

## Run

    npm install
    npm run dev            # fake events every 4s
    npm run dev:rabbit     # consume RabbitMQ exchange "hmis.events" (set RABBITMQ_URL if not guest/guest)

- http://localhost:5050  fake page (different origin from the widget)
- http://localhost:4000/widget.js  the embeddable bundle

Push an event by hand:

    curl -X POST localhost:4000/publish -d '{"type":"x","severity":"critical","message":"hi"}'
    RABBITMQ_URL=amqp://user:pass@localhost:5672 npm run publish:event -- "Code blue" critical

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
