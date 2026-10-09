// Builds the static demo into demo/dist, pointing the embed snippet and the HMIS
// integration at wherever the widget and server are deployed.
// Used by Cloudflare Pages and by the Docker image, so both behave the same.
//
//   WIDGET_URL=https://... SERVER_URL=https://... WIDGET_TOKEN=... INGEST_API_KEY=... node demo/build.mjs
//
// Any variable left unset keeps the local development value.

import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

const here = import.meta.dirname;
const dist = path.join(here, "dist");
const ASSETS = ["styles.css", "app.js", "hmis-integration.js"];

const { WIDGET_URL, SERVER_URL, WIDGET_TOKEN, INGEST_API_KEY } = process.env;

let html = readFileSync(path.join(here, "index.html"), "utf8");
if (WIDGET_URL) html = html.replaceAll("http://localhost:4100", WIDGET_URL.replace(/\/$/, ""));
if (SERVER_URL) html = html.replaceAll("http://localhost:4000", SERVER_URL.replace(/\/$/, ""));
if (WIDGET_TOKEN) html = html.replace(/data-token="[^"]*"/, `data-token="${WIDGET_TOKEN}"`);
if (INGEST_API_KEY) html = html.replace(/data-api-key="[^"]*"/, `data-api-key="${INGEST_API_KEY}"`);

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist);
writeFileSync(path.join(dist, "index.html"), html);
for (const file of ASSETS) cpSync(path.join(here, file), path.join(dist, file));

// Cloudflare Pages header rules: revalidate on every load so redeploys show up at once.
writeFileSync(path.join(dist, "_headers"), "/*\n  Cache-Control: no-cache\n");

console.log(`Demo built to ${path.relative(process.cwd(), dist) || "dist"}`, {
  widget: WIDGET_URL ?? "http://localhost:4100 (default)",
  server: SERVER_URL ?? "http://localhost:4000 (default)",
});
