# Demo HMIS (CityCare)

A stand-in for a real hospital management system. It exists to test the widget the way a
customer would use it: on someone else's site, on a different domain, with its own styles.

It plays two roles:

1. **Host page.** It embeds the widget with a single `<script>` tag and nothing else.
2. **Data source.** Its "Record observation" form sends vitals and lab results to the event
   server, the way a real HMIS backend would.

It is plain HTML, CSS and JavaScript. No framework, no dependencies.

## Folder structure

```
demo/
├── index.html            The CityCare dashboard, plus the widget <script> tag at the bottom
├── styles.css            All page styles (see "How the CSS is organised" below)
├── app.js                Page behaviour: date, patient search, theme and sidebar toggles
├── hmis-integration.js   The HMIS side of the integration: sends observations to the server
├── build.mjs             Writes dist/ with deployed URLs and keys filled in
├── nginx.conf            Serves the page with Cache-Control: no-cache (Docker only)
└── Dockerfile            Runs build.mjs, then serves dist/ with nginx
```

`hmis-integration.js` is kept separate from `app.js` on purpose: it is the only part a real HMIS
would need to write to integrate with us, and in production it would run on the HMIS server,
not in the browser.

### Build output (`dist/`)

```
dist/
├── index.html            URLs, widget token and API key replaced from env vars
├── styles.css
├── app.js
├── hmis-integration.js
└── _headers              Cloudflare Pages: Cache-Control: no-cache
```

## How the CSS is organised

`styles.css` is ordered top to bottom:

```
1. HOSTILE GLOBAL STYLES      Deliberately bad rules (Georgia everywhere, hot pink buttons,
                              `main` as a 3-column grid). They prove the widget's Shadow DOM
                              isolation works. Do not remove them.
2. DESIGN TOKENS              :root colours, spacing, shadows, sidebar widths. Then
                              :root[data-theme="dark"] overrides the same tokens for dark mode.
3. BASE & HOST OVERRIDES      `body .app-shell ...` rules that undo the hostile styles inside the
                              real app, plus the collapsed-sidebar rules.
4. Components                 Sidebar, topbar, main content, metrics, panels, ward occupancy,
                              activity feed, patient table, animations.
5. Responsive layouts         1200px (tablet). The 760px and 420px blocks are kept for a possible
                              phone layout but are currently hidden behind the small-screen gate.
6. Record observation         The HMIS form that sends data to the server.
7. Small-screen gate          Below 768px the app hides and a "use a larger screen" card shows.
8. Reduced motion             Turns off animations for users who ask for it.
```

Two rules that follow from this:

- **Use tokens, never raw colours.** Every colour comes from a `var(--...)` so dark mode works.
  Add a new token to both the light `:root` block and the dark block.
- **Beat the hostile styles with specificity.** A component rule that sets padding, font or
  background on a `button`, `main`, `li` or `*` may lose to the hostile block or the
  `body .app-shell button` reset. Scope it as `body .app-shell .your-class` when that happens.

## Theme and sidebar

- An inline script in `<head>` applies the saved theme and sidebar state before the first paint,
  so there is no flash. `app.js` keeps them updated.
- Theme: saved choice, otherwise the operating system setting. Stored as `citycare:theme`.
- Sidebar: expanded or collapsed to an icon rail. Stored as `citycare:sidebar`.

## Running

```bash
npm run dev                 # from the repo root: demo on http://localhost:5050
npm run docker:up           # production-like, demo built with values from .env
```

Building for a deployed setup:

```bash
WIDGET_URL=https://... SERVER_URL=https://... WIDGET_TOKEN=... INGEST_API_KEY=... node demo/build.mjs
```

Any variable left unset keeps its local development value.

## Adding a file

Add any new CSS or JS file to the `ASSETS` list in `build.mjs`, or it will not be deployed.
The Dockerfile and Cloudflare Pages both publish exactly what `build.mjs` writes to `dist/`.

## Security note

The demo calls `POST /observations` from the browser only because it has no backend, so its
API key is visible in the page source. The server rate limits that endpoint per IP. A real HMIS
makes the call from its own server and never exposes the key.
