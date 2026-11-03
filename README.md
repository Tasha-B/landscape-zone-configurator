# Landscape Zone Configurator

Interactive office floor plan for planning botanical design zone by zone.
The SVG map is ported from [Cairn Botanics](https://github.com/Tasha-B/cairn-botanics)
and is being grown into a fullstack editor.

## Stack

| Layer    | Tech                                              | Status  |
| -------- | ------------------------------------------------- | ------- |
| Frontend | React 19, TypeScript, Vite, Tailwind CSS v4, Framer Motion, TanStack Query, React Router, Vitest, Testing Library | showcase, plans page and editor; every change saved at once and shown live to other viewers |
| Backend  | NestJS 12, Prisma 7, REST + WebSockets            | REST for plans and zones with validation and `409` on stale versions, Socket.IO events after each saved change, Swagger UI, `/api/health` with a database check |
| Database | PostgreSQL 18                                     | schema, migrations and the demo plan seed; local, in Docker |
| DevOps   | Docker, docker-compose, GitHub Actions            | CI for both apps, backend e2e against Postgres, checks for a stale API contract; Postgres in docker-compose |

## Structure

```
frontend/   React app (Vite)
backend/    NestJS API
docs/       project documentation
```

## Docs

- [Phase 0 — Frontend port](docs/phase-0-frontend-port.md): features, structure and how the map was ported
- [Phase 0 — Roadmap](docs/phase-0-roadmap.md): backend stack, data model, API and phases 1–10
- [Phase 1 — Zone model: plan](docs/phase-1-zone-model-plan.md): one `Zone` record per zone, computed markers and areas
- [Phase 1 — Zone model](docs/phase-1-zone-model.md): the model, what is computed, the L-shaped open floor, tests and visual check
- [Phase 2 — Backend scaffold: plan](docs/phase-2-backend-scaffold-plan.md): NestJS 12 API with env validation and `/api/health`, Postgres 18 in Docker, npm workspaces
- [Phase 2 — Backend scaffold](docs/phase-2-backend-scaffold.md): versions, env validation, health, local Postgres, CI and findings
- [Phase 3 — Database: plan](docs/phase-3-database-plan.md): Prisma 7 schema, first migration, seed from the demo plan, database health check
- [Phase 3 — Database](docs/phase-3-database.md): Prisma 7 setup, schema, seed, `PrismaService` and health, CI with Postgres, findings
- [Phase 4 — Read API: plan](docs/phase-4-read-api-plan.md): `GET /api/plans/:id`, Swagger, generated types, the frontend on TanStack Query, plan backgrounds
- [Phase 4 — Read API](docs/phase-4-read-api.md): the endpoint, the OpenAPI → types contract, loading and error states, backgrounds and anchored notes, findings
- [Phase 5 — CRUD: plan](docs/phase-5-crud-plan.md): create, update and delete for plans and zones, validation, `409` on a stale version
- [Phase 5 — CRUD](docs/phase-5-crud.md): the endpoints, versions and `409`, validation by shape kind, tests, findings
- [Phase 6 — Editor: plan](docs/phase-6-editor-plan.md): the plans page and the editor, routing, saving each change with rollback and `409` handling
- [Phase 6 — Editor](docs/phase-6-editor.md): the pages, editing on the canvas and in the panels, pending changes over the confirmed plan, checks, findings
- [Phase 7 — Realtime: plan](docs/phase-7-realtime-plan.md): Socket.IO rooms per plan, events after each saved change, the cache moving only forward, the editor under other viewers' changes
- [Phase 7 — Realtime](docs/phase-7-realtime.md): the protocol, the cache moving only forward, `usePlanLive`, the editor under other viewers' changes, checks, findings

## Run locally

The repo is an npm workspace: install and run everything from the root.

The page loads the plan from the API, so it needs the database, the API and the frontend. The database needs Docker Desktop, and the API a `backend/.env`:

```bash
npm install            # installs every app from the root package-lock.json
cp backend/.env.example backend/.env
npm run db:up          # Postgres 18 in Docker, waits until it is healthy
npm run db:deploy      # create the tables (apply the migrations)
npm run db:seed        # load the demo office; safe to run again
npm run dev:backend    # API on http://localhost:3000 (keep it running)
npm run dev:frontend   # in a second terminal: http://localhost:5173
npm run db:down        # stop Postgres; the data is kept
```

The showcase is at http://localhost:5173, the plans and their editor at http://localhost:5173/plans (the editor needs a window at least 768 px wide). Vite forwards `/api` to the API. Swagger UI is at http://localhost:3000/api/docs; its "Try it out" buttons create, change and delete plans and zones. Without the API the page shows an error with a "Try again" button. If the demo office was changed or deleted, `npm run db:seed` restores it.

To see live updates, open the same plan's editor in two tabs, or the demo office's editor and the showcase. A zone moved, added or deleted in one shows in the other without a reload. Stop the API and the editor's status line says updates are paused; start it again and the plan catches up.

Other database scripts: `npm run db:migrate -- --name <name>` creates a migration from changes to `backend/prisma/schema.prisma`, and `npm run db:studio` opens Prisma Studio to browse the data. The backend e2e tests (`npm run test:e2e -w backend`) also need `db:up`; they use a separate `lzc_test` database.

After changing the API's responses, regenerate the contract and commit both files; CI fails when they are stale:

```bash
npm run api:spec       # backend/openapi.json, from the controllers and response classes
npm run api:types      # frontend/src/lib/api/schema.d.ts, from openapi.json
```

Root scripts `npm run lint`, `npm run typecheck`, `npm test` and `npm run build` run in every app. To target one app, add `-w <app>`, for example `npm run test:watch -w frontend` or `npm run test:e2e -w backend`.

CI (GitHub Actions) runs lint, typecheck, tests and build for both apps, in parallel jobs, on every pull request and on every push to `main`.
