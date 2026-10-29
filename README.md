# Landscape Zone Configurator

Interactive office floor plan for planning botanical design zone by zone.
The SVG map is ported from [Cairn Botanics](https://github.com/Tasha-B/cairn-botanics)
and is being grown into a fullstack editor.

## Stack

| Layer    | Tech                                              | Status  |
| -------- | ------------------------------------------------- | ------- |
| Frontend | React 19, TypeScript, Vite, Tailwind CSS v4, Framer Motion, Vitest | ✅ |
| Backend  | NestJS, REST + WebSockets                         | planned |
| Database | PostgreSQL                                        | planned |
| DevOps   | Docker, docker-compose, GitHub Actions            | planned |

## Structure

```
frontend/   React app (Vite)
backend/    NestJS API (planned)
docs/       project documentation
```

## Docs

- [Phase 0 — Frontend port](docs/phase-0-frontend-port.md): features, structure and how the map was ported
- [Phase 0 — Roadmap](docs/phase-0-roadmap.md): backend stack, data model, API and phases 1–10
- [Phase 1 — Zone model: plan](docs/phase-1-zone-model-plan.md): one `Zone` record per zone, computed markers and areas
- [Phase 1 — Zone model](docs/phase-1-zone-model.md): the model, what is computed, the L-shaped open floor, tests and visual check
- [Phase 2 — Backend scaffold: plan](docs/phase-2-backend-scaffold-plan.md): NestJS 12 API with env validation and `/api/health`, Postgres 18 in Docker, npm workspaces

## Run locally

The repo is an npm workspace: install and run everything from the root.

```bash
npm install            # installs every app from the root package-lock.json
npm run dev:frontend   # Vite dev server
```

Root scripts `npm run lint`, `npm run typecheck`, `npm test` and `npm run build` run in every app. To target one app, add `-w <app>`, for example `npm run test:watch -w frontend` or `npm run preview -w frontend`.

CI (GitHub Actions) runs lint, typecheck, tests and build for the frontend on every pull request and on every push to `main`.
