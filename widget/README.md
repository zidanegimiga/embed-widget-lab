# Widget

A draggable React panel that any website can embed with one script tag. It floats above the
host page and shows live patient events streamed from the event server.

```html
<script src="https://WIDGET_HOST/widget.js" data-token="..." async></script>
```

The host page needs no other changes, and its CSS cannot affect the widget (and the widget's
CSS cannot affect the page).

## Folder structure

```
widget/
├── src/
│   ├── index.tsx           Public entry: init(), destroy(), and auto-start from the <script> tag
│   ├── Widget.tsx          The panel UI: header, event list, details, footer
│   ├── useDraggable.ts     Pointer-event dragging, anchored to the nearest corner, saved
│   ├── useEventStream.ts   Connects over WebSocket or SSE, reconnects, keeps the last 50 events
│   ├── types.ts            WidgetConfig, HmisEvent, ConnectionStatus
│   ├── widget.css          All widget styles. Injected into the shadow root, never the page
│   └── vite-env.d.ts       Types for build-time env vars (VITE_SERVER_URL)
├── public/
│   └── _headers            Cloudflare Pages headers: CORS + short cache for the bundle
├── vite.config.ts          Library build: one self-contained file per format, React included
├── nginx.conf              Same headers as _headers, for the Docker image
├── Dockerfile              Builds the bundle, serves it with nginx
├── .env.example            VITE_SERVER_URL
├── package.json            Scripts: build, watch, preview
└── tsconfig.json
```

### Build output (`dist/`)

```
dist/
├── widget.js     IIFE for <script> tags. Exposes window.HMISWidget
├── widget.mjs    ES module for bundlers: import { init } from '@lab/hmis-widget'
└── _headers      Copied from public/
```

## How it works

1. **Mounting** (`index.tsx`). `init()` appends one full-screen `<div>` to `<body>` with
   `pointer-events: none`, so clicks pass through to the page. It attaches a Shadow DOM, injects
   `widget.css` into it, and renders React there. Only the panel turns pointer events back on.
2. **Auto-start**. When loaded by a `<script>` tag, the bundle reads its own `data-*` attributes
   and calls `init()` once the DOM is ready. `document.currentScript` is captured at load time,
   because it is only available while the script first runs.
3. **Dragging** (`useDraggable.ts`). Pointer events cover mouse, touch and pen. Pointer capture
   keeps the drag going if the cursor leaves the header. The widget starts 24px from the
   bottom-right corner. When dropped, it anchors to the nearest corner: in the top half it keeps
   its top edge and grows downward, in the bottom half it keeps its bottom edge and grows upward.
   That keeps it where the user put it as the window resizes and the event list changes height.
   The position is clamped to the viewport and saved in `localStorage`.
4. **Streaming** (`useEventStream.ts`). SSE uses `EventSource`, which reconnects by itself.
   WebSocket reconnects with exponential backoff up to 15 seconds. The token goes in the query
   string because browsers cannot set headers on either.
5. **Small screens**. Below 768px wide the panel hides, matching the HMIS's supported sizes.

## Configuration

Script tag attributes:

| Attribute         | Default                    | Purpose                                      |
|-------------------|----------------------------|----------------------------------------------|
| `data-url`        | `VITE_SERVER_URL` at build | Event server URL                             |
| `data-token`      | none                       | Widget token issued by the server            |
| `data-transport`  | `ws`                       | `ws` or `sse`                                |
| `data-title`      | `HMIS Live`                | Header text                                  |
| `data-autoinit`   | on                         | Set to `false` to call `HMISWidget.init()` yourself |

From a bundler:

```js
import { init, destroy } from '@lab/hmis-widget';

init({ url: 'https://events.example.com', transport: 'sse', token: '...' });
```

## Event shape

What the widget renders, as sent by the server:

```json
{
  "id": "uuid",
  "ts": "2026-10-09T07:05:31.142Z",
  "type": "lab.assessed",
  "severity": "critical",
  "message": "Potassium 6.4 mmol/L is critically high for P. Otieno",
  "patient": "P. Otieno / MRN 100871",
  "source": "CityCare HMIS",
  "details": { "Result": "6.4 mmol/L", "Reference range": "3.5 to 5 mmol/L" }
}
```

`severity` sets the coloured left edge (`info` grey, `warning` amber, `critical` red with a
tinted background). `details` renders as a label/value list.

## Scripts

```bash
npm run build      # dist/widget.js and dist/widget.mjs
npm run watch      # rebuild on change
npm run preview    # serve dist/ on http://localhost:4100
```

Set `VITE_SERVER_URL` when building for a deployed server, so host pages can omit `data-url`.

## Size

About 71 KB gzipped, mostly React. Swapping in Preact (`preact/compat`) would bring it under
20 KB without changing the components.
