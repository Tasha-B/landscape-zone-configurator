# Landscape Zone Configurator

Interactive office floor plan for planning botanical design zone by zone.
The SVG map is ported from [Cairn Botanics](https://github.com/Tasha-B/cairn-botanics)
and is being grown into a fullstack editor.

## Stack

| Layer    | Tech                                              | Status  |
| -------- | ------------------------------------------------- | ------- |
| Frontend | React 19, TypeScript, Vite, Tailwind CSS v4, Framer Motion, Vitest | ✅ |
| Backend  | NestJS 12, REST + WebSockets                      | scaffold: env validation, `/api/health` |
| Database | PostgreSQL 18                                     | local, in Docker; not connected yet |
| DevOps   | Docker, docker-compose, GitHub Actions            | CI for both apps; Postgres in docker-compose |

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

## Run locally

The repo is an npm workspace: install and run everything from the root.

```bash
npm install            # installs every app from the root package-lock.json
npm run dev:frontend   # Vite dev server on http://localhost:5173
```

The API needs Docker Desktop for its database and a `backend/.env`:

```bash
cp backend/.env.example backend/.env
npm run db:up          # Postgres 18 in Docker, waits until it is healthy
npm run dev:backend    # API on http://localhost:3000, check GET /api/health
npm run db:down        # stop Postgres; the data is kept
```

Root scripts `npm run lint`, `npm run typecheck`, `npm test` and `npm run build` run in every app. To target one app, add `-w <app>`, for example `npm run test:watch -w frontend` or `npm run test:e2e -w backend`.

CI (GitHub Actions) runs lint, typecheck, tests and build for both apps, in parallel jobs, on every pull request and on every push to `main`.
