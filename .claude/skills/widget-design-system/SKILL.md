---
name: widget-design-system
description: Visual design system and UI rules for the embeddable widget in widget/. Use when changing anything the widget renders (widget/src/Widget.tsx, widget/src/widget.css), adding UI elements, colours, states or event fields to the widget, or reviewing widget UI changes.
---

# Widget design system

The widget is a 340px floating panel that lives inside a Shadow DOM on someone else's website.
Every rule below exists because of that.

## Hard constraints

1. **All styles go in `widget/src/widget.css`.** It is injected into the shadow root by
   `index.tsx`. Never use inline `style={{...}}` for visual styling (the drag position from
   `useDraggable`, two of `top`/`right`/`bottom`/`left`, is the only exception), never inject `<style>` into `document.head`, never use CSS-in-JS.
2. **Never touch the host page.** No global selectors that could leak (`:root`, `html`, `body`),
   no `document.body.style`, no global event listeners except `resize` in `useDraggable.ts`.
3. **`.panel` starts with `all: initial`.** That resets inheritance from the host. Any new element
   inside must get its font, colour and spacing from widget.css, not from browser defaults.
4. **Only `.panel` has `pointer-events: auto`.** The host layer is `pointer-events: none` so the
   page stays clickable. Do not add full-screen overlays inside the widget.
5. **Hidden below 768px.** Keep the `@media (max-width: 767px)` rule at the end of widget.css.
6. **System font stack only.** `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`.
   Do not load web fonts: the host may block them with its Content Security Policy.

## Palette

| Role                     | Value                         | Used on                              |
|--------------------------|-------------------------------|--------------------------------------|
| Header background        | `#0f2a44`                     | `header`                             |
| Panel background         | `#fff`                        | `.panel`                             |
| Panel border             | `#d5dbe3`                     | `.panel`                             |
| Body text                | `#1c2430`                     | `.panel`, footer button              |
| Secondary text           | `#6b7785`                     | `time`, `.patient`, `dt`, footer     |
| Tertiary text            | `#8a96a3`                     | `.source`, empty state               |
| Divider                  | `#eef1f5`                     | between list items                   |
| Soft surface             | `#f4f6f9` / `#f7f9fb`         | `.details` / `footer`                |
| Info edge                | `#8aa0b8`                     | `li` default                         |
| Warning                  | `#f5a524`                     | `li.warning`, connecting dot         |
| Critical / error         | `#e5484d` (bg tint `#fff6f6`) | `li.critical`, closed dot, badge     |
| Connected                | `#2fbf71`                     | `.dot.open`                          |

Reuse these values. If a new colour is genuinely needed, add it next to similar rules and list
it in this table.

## Severity

Severity is shown in exactly one way: the 3px left edge of the list item (`border-left`), plus a
background tint for `critical` only. Do not add severity icons, badges or coloured text on top.

## Type scale

| Size | Weight | Use                                   |
|------|--------|---------------------------------------|
| 13px | 400    | message text, header title (bold)     |
| 12px | 600    | event `type` label                    |
| 11px | 400/500| time, patient, details, footer        |
| 10px | 400    | `via source`                          |

## Spacing and shape

- List items: `8px 12px` padding. Header: `10px 12px`. Footer: `6px 12px`.
- Radii: panel `10px`, details block and buttons `6px`, badge `9px` (pill).
- One shadow only: `0 12px 32px rgba(15, 23, 42, 0.18)` on `.panel`.

## Event anatomy (top to bottom)

```
type ................................ time      .row: .type + <time>
message                                           plain <div>
patient                                           .patient (optional)
┌ label   value ┐                                 dl.details (optional, max 8 rows)
└ label   value ┘
via source                                        .source (optional)
```

New event fields go in this order and must be optional, because older servers will not send
them. Update `HmisEvent` in `widget/src/types.ts` at the same time.

## Writing style for UI text

Short, plain, sentence case. No exclamation marks, no emojis, no em dashes.
Examples in use: "Waiting for events...", "Clear", "3 events".

## Checklist before finishing

- [ ] Styles only in widget.css, no new globals
- [ ] Colours from the palette table
- [ ] New fields optional and typed in types.ts
- [ ] `npx tsc -p widget` passes and `npm run build -w widget` succeeds
- [ ] Checked on the demo page (http://localhost:5050) against its hostile global styles
