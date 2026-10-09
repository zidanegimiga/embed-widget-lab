---
name: demo-hmis-styling
description: Styling and structure rules for the CityCare demo HMIS in demo/ (index.html, styles.css, app.js, hmis-integration.js). Use when changing the demo page layout, adding panels, buttons, form fields or colours, touching dark mode or the sidebar, or when a demo element looks unstyled or wrongly spaced.
---

# Demo HMIS styling

The demo is a fake hospital system whose job is to stress-test the widget. Its stylesheet is
deliberately hostile at the top, which causes most demo styling bugs. Read `demo/README.md` for
the file layout.

## The hostile block is intentional

The first section of `styles.css` sets `* { font-family: Georgia !important }`,
`button { background: hotpink !important; padding: 20px !important }`,
`main { display: grid; grid-template-columns: repeat(3, 1fr) }` and similar. They prove the
widget's Shadow DOM isolation. **Never delete or weaken them.** Override them for the app
instead.

## Specificity: why a style "does not apply"

Before debugging a layout, check these known traps:

| Symptom                               | Cause                                         | Fix                                                   |
|---------------------------------------|-----------------------------------------------|-------------------------------------------------------|
| Button has no padding                 | `body .app-shell button { padding: 0 !important }` | Selector `body .app-shell .your-class` with `padding: ... !important` |
| Button is hot pink                    | hostile `button` rule                         | `background: ... !important` on a class selector      |
| Element laid out in 3 columns         | hostile `main` grid                           | Give the element its own `display`                    |
| `li` text is 22px                     | hostile `li` rule                             | Already reset by `body .app-shell li`                 |
| Declaration ignored entirely          | invalid value, e.g. `padding: 8 14px`         | Every non-zero length needs a unit                    |
| `[hidden]` element still visible      | a class sets `display`                        | Add `.your-class[hidden] { display: none; }`          |

## Colours: tokens only

- Use `var(--token)` for every colour, border and shadow. Raw hex values break dark mode.
- Available tokens are in the `:root` block (light) and `:root[data-theme="dark"]` (dark).
- A new token must be added to **both** blocks.
- `--navy` is heading text (light in dark mode). Use `--sidebar` for dark backgrounds that
  must stay dark in both themes.
- Exception: text on a solid teal or sidebar background may use `#fff`.

## Layout conventions

- Sections in the main column are `.panel` elements, separated by `25px` (match
  `.dashboard-grid` and `.feed-panel`).
- Panel padding `23px`, radius `var(--radius)`, shadow `var(--shadow)`.
- Form controls: `38px` tall, `9px` radius, `var(--surface-soft)` background,
  `var(--border)` border, teal border on focus.
- Primary button: teal background, white text, `0 18px` padding.
- Sidebar items need both `.nav-icon` and `<span class="nav-text">`, or they vanish in the
  collapsed rail.
- Below 768px the whole app is replaced by `.device-gate`. Do not build phone layouts.

## Behaviour conventions

- `app.js`: page behaviour (search, date, theme, sidebar). `hmis-integration.js`: only code a
  real HMIS would own (talking to our server). Keep them separate.
- Preferences use `localStorage` keys `citycare:theme` and `citycare:sidebar`, always inside
  try/catch. The inline `<head>` script and `app.js` must use the same keys.
- Icons are inline SVGs with `stroke="currentColor"` (topbar) or short Unicode glyphs (sidebar).
  Mark decorative icons `aria-hidden="true"`; icon-only buttons need `aria-label`.

## New files

Add any new CSS or JS file to `ASSETS` in `demo/build.mjs`, or it will not be deployed.

## Verify

1. `npm run docker:up` (or `npm run dev`), open http://localhost:5050.
2. Check light and dark mode, sidebar expanded and collapsed, and widths 1440px and 768px.
3. If a change seems to have no effect, the browser may have a cached copy: reload with the
   cache bypassed. The demo's nginx sends `Cache-Control: no-cache`, so this should be rare.
