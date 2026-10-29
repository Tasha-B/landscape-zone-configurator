# Phase 2 — Backend scaffold

Part of the [roadmap](phase-0-roadmap.md). The plan and its decisions are in [phase-2-backend-scaffold-plan.md](phase-2-backend-scaffold-plan.md).

The repo now holds two apps in one npm workspace. `backend/` is a NestJS 12 API that validates its environment at startup and answers `GET /api/health`. PostgreSQL 18 runs locally in Docker. CI checks both apps in parallel jobs.

The API does not connect to the database yet; Prisma comes in phase 3. The frontend is unchanged.

## Versions

| Concern | Choice |
| --- | --- |
| Framework | NestJS 12, ESM (`"type": "module"`) |
| Language | TypeScript 6 in the backend, TypeScript 7 in the frontend; each workspace keeps its own |
| Config | `@nestjs/config`, validated with `class-validator` + `class-transformer` |
| Health | `@nestjs/terminus` |
| Tests | Vitest 5 (shared with the frontend) + Supertest |
| Lint | oxlint (shared), no Prettier |
| Database | PostgreSQL 18 (`postgres:18-alpine`) |
| Node | 24; the Nest 12 generators need 24.15+ |

The roadmap listed NestJS 11, Jest and PostgreSQL 17. It was written before the current releases and has been updated.

## Structure

```
.
├── package.json              workspaces: frontend, backend; root scripts
├── package-lock.json         one lockfile for both apps
├── docker-compose.yml        db: postgres:18-alpine
├── frontend/
└── backend/
    ├── .env.example
    ├── src/
    │   ├── main.ts           bootstrap, port from the validated config
    │   ├── app.ts            configureApp(): the /api prefix
    │   ├── app.module.ts     ConfigModule + HealthModule
    │   ├── config/env.ts     Env class + validate()
    │   └── health/           HealthModule, HealthController
    └── test/
        └── health.e2e-spec.ts
```

## Workspaces

`frontend/package-lock.json` was replaced by one lockfile in the root, and dependencies are installed into the root `node_modules`. When the lockfile was regenerated, the only real version changes were patches: rolldown 1.2.15 → 1.2.16 and two type packages. `lightningcss` moved to another place in the tree, but Tailwind and Vite resolve the same versions as before.

| Root script | Does |
| --- | --- |
| `dev:frontend`, `dev:backend` | dev servers; extra arguments are forwarded (`npm run dev:frontend -- --port 5180`) |
| `db:up`, `db:down` | start Postgres and wait until it is healthy; stop it, keeping the data |
| `lint`, `typecheck`, `test`, `build` | run in every app; add `-w <app>` for one |

## Environment

`ConfigModule.forRoot({ validate })` checks the environment once at startup. On an invalid value the app exits with code 1 and lists every bad variable:

```
Error: Invalid environment:
  NODE_ENV: NODE_ENV must be one of the following values: development, test, production
  PORT: PORT must not be greater than 65535; PORT must not be less than 1; PORT must be an integer number
  DATABASE_URL: DATABASE_URL must be a URL address
```

| Variable | Rule | Default |
| --- | --- | --- |
| `NODE_ENV` | `development`, `test` or `production` | `development` |
| `PORT` | integer 1–65535 | `3000` |
| `DATABASE_URL` | `postgresql://` or `postgres://` URL | required |

Variables from the process environment win over `backend/.env`. An empty value (`PORT=`) counts as unset, so the default applies instead of `""` turning into `0`.

Two things about the `Env` class are easy to break:

- **Every property needs an explicit type** (`PORT: number = 3000`). `class-transformer` converts `"8080"` to a number by reading the property type from decorator metadata, and an inferred type is emitted as `Object`, which leaves the value a string. A unit test catches this; it was checked by removing the annotation.
- **`env.ts` imports `reflect-metadata` itself.** Nest loads it in the app, but unit tests import `env.ts` without Nest.

## Health

`GET /api/health` returns `200 {"status":"ok","info":{},"error":{},"details":{}}`. It checks nothing external yet. Phase 3 adds a Prisma ping, so the endpoint answers `503` while the database is down.

Every route lives under `/api`. The prefix is set in `configureApp()`, which both `main.ts` and the e2e test call, so the tests hit the same URLs as the running app. Without it, the e2e tests fail, which was checked.

## Local Postgres

`npm run db:up` starts `postgres:18-alpine` with user, password and database `lzc`, on port 5432 (`DB_PORT` overrides it), and waits for the `pg_isready` healthcheck. The credentials are for local development only.

The Postgres 18 image keeps its data in `/var/lib/postgresql/18/docker`, so the `pgdata` volume is mounted at `/var/lib/postgresql`, not at `.../data` as with older images.

Checked: the container becomes healthy (PostgreSQL 18.6); a client on the host connects with the `DATABASE_URL` from `.env.example`; a wrong password is rejected; data survives `db:down` and `db:up`.

## Tests and CI

| Suite | Covers |
| --- | --- |
| `src/config/env.spec.ts` (15) | a complete env and type conversion; defaults; empty values; unrelated variables; each invalid `DATABASE_URL`, `PORT` and `NODE_ENV`; all errors listed at once |
| `test/health.e2e-spec.ts` (3) | `GET /api/health` is ok; `/health` without the prefix is 404; unknown `/api` routes are 404 |

The e2e config sets a placeholder `DATABASE_URL`, because no test uses the database yet and CI has no `.env`.

CI runs two parallel jobs: `Frontend — lint, typecheck, build` (unchanged name, a required check) and `Backend — lint, typecheck, test, build` (lint, typecheck, unit, e2e, build). Each installs from the root lockfile. There is no path filter: a required check that never runs blocks the PR. Before the push, the workflow passed `actionlint`, and both jobs passed in a `node:24` Linux container on a clean copy of the repo.

## Findings

- **Decorator metadata works under Vitest 5 without SWC.** Nest injects constructor dependencies by reading `design:paramtypes`. Older Vitest setups compiled tests with esbuild, which does not emit it, and needed `unplugin-swc`. Vite 8 compiles with Oxc, which does. The scaffold's hello-world test proved this before it was replaced; now `HealthController` relies on it.
- **The Nest 12 ESM template had a CommonJS-style import.** The e2e test imported `supertest/types`. In ESM a subpath of a package without `exports` needs the file extension, so `tsc` failed. It is now `supertest/types.js`. The tests still ran before the fix, because the import is type-only and is erased.
- **Classes injected through a constructor must not be imported with `import type`.** The import is erased, the metadata falls back to `Object`, and Nest cannot resolve the provider.

## Deviations from the plan

- The hello-world controller stayed until step 4 instead of being removed in step 2, so that step 2 still had tests and could prove that injection works.
- `frontend/.oxlintrc.json` now points its `$schema` at the root `node_modules`. The schema is used by editors only.

## Known gaps

- **The backend check is not required yet.** After this phase merges, `Backend — lint, typecheck, test, build` has to be added to the required checks of the `main` ruleset.
- **The health check does not cover the database** until phase 3.
- **The frontend does not call the API yet.** The Vite `/api` proxy comes with the read path in phase 4.
- **Only Postgres runs in Docker.** API and frontend images come in phase 8.
