---
name: server-conventions
description: Architecture rules and coding conventions for the Express event server in server/. Use when adding or changing server endpoints, modules, middleware, config variables, RabbitMQ usage or event transports, or when reviewing server code.
---

# Server conventions

Read `server/README.md` for the folder tree and request flow. This skill is the rulebook.

## Runtime rules (breaking these crashes Node)

Node 24 runs the `.ts` files directly by stripping types. There is no compile step, so:

- Import local files **with the `.ts` extension**: `import { config } from '../config/env.ts'`.
- Use **erasable syntax only**: no `enum`, no `namespace`, no constructor parameter properties
  (`constructor(private x)`), no `import x = require()`. Use `as const` objects instead of enums.
- Type-only imports use `import type` (enforced by `verbatimModuleSyntax`).
- `npx tsc` (from `server/`) only type-checks. Run it after every change.

## Where code goes

| Kind of code                         | Location                                    |
|--------------------------------------|---------------------------------------------|
| New feature with endpoints           | `src/modules/<feature>/`                    |
| Shared infrastructure (no business)  | `src/lib/`                                  |
| Request gatekeeping                  | `src/middleware/`                           |
| New environment variable             | `src/config/env.ts` + `server/.env.example` |
| One-off CLI                          | `src/scripts/`                              |

A module folder contains, as needed:

```
modules/<feature>/
├── <feature>.schema.ts       Zod schemas and inferred types
├── <feature>.routes.ts       Router: path + middleware + controller, nothing else
├── <feature>.controller.ts   Parse input, call logic, send response. No business rules
└── ...                       Logic files named for what they do (pipeline, processors/)
```

Mount new routers in `src/app.ts`, before `notFound`.

## Dependency direction

`config` <- `lib` <- `middleware` <- `modules` <- `app.ts` <- `server.ts`.
`lib` and `config` never import from `modules`. One module uses another only through functions
it exports on purpose (for example `ingestEvent()` from `events/producers/index.ts`).

## Patterns to follow

- **Singletons are module-level instances**: `config`, `logger`, `eventBus`, the RabbitMQ
  connection. Do not create classes with `getInstance()`.
- **Validate at the edge with Zod.** Controllers call `schema.parse(req.body)`. A `ZodError`
  becomes a 400 automatically in `error-handler.ts`.
- **Expected failures throw `HttpError(status, message)`.** Do not `res.status().json()` errors
  by hand. Express 5 forwards rejected async handlers to the error handler.
- **RabbitMQ consumers use `createResilientChannel()`** from `lib/rabbitmq.ts`. Never open a
  channel and consume without it, or the consumer dies silently when the broker restarts.
- **Producers publish to `eventBus`; transports subscribe to it.** Never make a transport call a
  producer or the other way round.
- **Anything that must reach every widget goes through `ingestEvent()`**, which publishes to the
  RabbitMQ fanout so every server instance receives it. Calling `eventBus.publish()` directly
  only reaches widgets connected to the current instance.

## Security rules

- Browser-facing auth (`WIDGET_TOKEN`) uses the query string; HMIS-facing auth
  (`INGEST_API_KEY`) uses `Authorization: Bearer`. Compare secrets with the helpers in
  `lib/access.ts` (constant-time), never with `===`.
- New write endpoints get `ingestRateLimit` first, then `requireApiKey`.
- Never log secrets, tokens, full headers or request bodies. The request serializer in `app.ts`
  already redacts `token`; keep it that way.
- Secrets required in production are enforced in the `superRefine` in `config/env.ts`.

## Production behaviour to preserve

- No fake events and no inline processing in production; RabbitMQ unreachable at startup means
  the process exits (`producers/index.ts`).
- Graceful shutdown in `server.ts` closes the observation worker, producer, WebSocket server,
  HTTP server (including open SSE streams) and the RabbitMQ connection, in that order.

## Checklist before finishing

- [ ] `npx tsc` in `server/` passes
- [ ] New env vars in `env.ts`, `.env.example`, and `docker-compose.yml` / `render.yaml` if needed
- [ ] Errors go through `HttpError` or Zod
- [ ] `server/README.md` tree and endpoint table updated if files or routes changed
