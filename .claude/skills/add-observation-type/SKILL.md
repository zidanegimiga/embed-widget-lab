---
name: add-observation-type
description: Step-by-step recipe for supporting a new kind of patient data that the HMIS sends to POST /observations (for example blood glucose monitoring, fluid balance, pain scores, medication administration), or a new lab test or vital sign. Use when the server must assess a new type of HMIS data and stream the result to the widget.
---

# Add an observation type

Observations are raw patient data from the HMIS. The server assesses them and streams a result
event to the widget. All of this lives in `server/src/modules/observations/`.

```
POST /observations -> observation.schema.ts (validate)
                   -> observation.pipeline.ts (durable queue)
                   -> processors/index.ts (pick processor by kind)
                   -> processors/<kind>.processor.ts (assess, build EventInput)
                   -> ingestEvent() -> widgets
```

The pipeline, queue and transports never need changing for a new type.

## Smaller case: a new lab test or vital sign

1. Add the range to `LAB_TESTS` or `VITAL_SIGNS` in `reference-ranges.ts`
   (`label`, `unit`, `low`, `high`, optional `criticalLow` / `criticalHigh`).
2. For a vital sign only: add the optional number field to `vitalsSchema.data` in
   `observation.schema.ts`. Lab tests are picked up from `LAB_TESTS` automatically.
3. Demo form: add the `<option>` (lab) or `<input>` (vital) in `demo/index.html`, and for a vital
   add its name to the list in `readData()` in `demo/hmis-integration.js`.
4. Mind the widget's limit of 8 `details` per event (vitals use one row per reading plus Ward
   and Recorded by).

## Full case: a new observation kind

### 1. Schema (`observation.schema.ts`)

Add a Zod object with `...common`, a literal `kind`, and a `data` object. Add it to the
`discriminatedUnion` and export its output type.

```ts
const glucoseSchema = z.object({
  ...common,
  kind: z.literal('glucose'),
  data: z.object({ value: z.number().min(0).max(50), fasting: z.boolean() }),
});

export const observationSchema = z.discriminatedUnion('kind', [vitalsSchema, labSchema, glucoseSchema]);
export type GlucoseObservation = z.output<typeof glucoseSchema>;
```

### 2. Thresholds (`reference-ranges.ts`)

If the assessment is "value against a range", add a `Range` and reuse `assess()`,
`worstSeverity()` and `formatReading()`. Do not write new comparison logic.

### 3. Processor (`processors/<kind>.processor.ts`)

A pure function `(obs) => EventInput`. No I/O, no logging, so it is trivial to test.

- `type`: `<kind>.assessed`
- `severity`: from `assess()` / `worstSeverity()`
- `message`: one sentence naming the patient and the finding, e.g.
  `"Fasting glucose 2.6 mmol/L is critically low for J. Wanjiru"`
- `patient`: `patientLabel(obs)`; `source`: `obs.source`
- `details`: the readings first, then `...contextDetails(obs)`. Max 8 entries in total.

### 4. Register it (`processors/index.ts`)

Add one `case` to the `switch`. TypeScript will fail the build if a kind is missing.

### 5. HMIS side (`demo/`)

Add the option to the `#obs-kind` select, a `<fieldset class="feed-row" data-kind="<kind>" hidden>`
with its inputs in `index.html`, and a branch in `readData()` in `hmis-integration.js`.
Fieldsets toggle automatically by `data-kind`.

### 6. Docs

Add the kind and its `data` fields to the observation table in the root `README.md`.

## Rules

- Thresholds in this project are demo values, not clinical guidance. Say so in a comment if you
  add new ones, and do not present them as a clinical standard.
- Keep processors pure. Anything that talks to RabbitMQ belongs in the pipeline.
- Existing kinds must keep accepting the same payloads; the HMIS is not ours to update.

## Verify

```bash
cd server && npx tsc
```

Then post a sample with curl (key from `.env` as `INGEST_API_KEY`) and watch it in the widget
on http://localhost:5050. Also send an invalid payload and confirm a 400 with a clear issue.
