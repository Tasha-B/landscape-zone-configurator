# Phase 3 — Database

Part of the [roadmap](phase-0-roadmap.md). The plan and its decisions are in [phase-3-database-plan.md](phase-3-database-plan.md).

Floor plans and zones now have tables in PostgreSQL. A Prisma schema and its first migration create them, and a seed loads the demo office from phase 1. The API has a database client, and `/api/health` answers `503` while the database is down. CI runs the backend e2e tests against a Postgres service container.

No endpoint reads plans yet; that is phase 4. The frontend is unchanged.

## Prisma 7

**Prisma 7.10.1**, pinned exactly in `prisma`, `@prisma/client` and `@prisma/adapter-pg`. npm's `latest` tag for the `prisma` CLI points to an 8.0 release candidate, so a plain `npm install prisma` installs a CLI that does not match the client. The CLI also prints an "Update available 7.10.1 -> 8.0.0-rc" banner; ignore it until Prisma 8 is stable.

| Concern | How it works here |
| --- | --- |
| Client | Generator `prisma-client` writes TypeScript into `backend/src/generated/prisma/`. The folder is ignored by git and by oxlint, and `postinstall` runs `prisma generate`, so the client exists after `npm install` or `npm ci`. |
| Connection | The driver adapter `@prisma/adapter-pg` on top of `pg`. |
| CLI config | `backend/prisma.config.ts`: the schema and migrations paths, the seed command and the URL. Prisma 7 does not read `.env` by itself, so the config loads `backend/.env` when it exists, with `process.loadEnvFile()`. Variables already set in the environment win, which is how CI and the e2e tests pass their own `DATABASE_URL`. `prisma generate` needs no URL, so it also works without a `.env`. |

## Structure

```
backend/
├── prisma.config.ts
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   │   ├── migration_lock.toml
│   │   └── 20261029200550_init/migration.sql
│   ├── demo-plan.ts          seedDemoPlan(), fixed ids
│   └── seed.ts               `npm run db:seed`
├── src/
│   ├── generated/prisma/     generated client (git-ignored)
│   ├── prisma/               PrismaModule (global), PrismaService
│   └── health/               now pings the database
├── test/
│   ├── global-setup.ts       applies migrations before the e2e run
│   ├── health.e2e-spec.ts
│   └── seed.e2e-spec.ts
├── tsconfig.json             solution file: app + tools
├── tsconfig.app.json         src/, Node's ESM rules
├── tsconfig.tools.json       prisma/, test/, configs; bundler resolution
└── tsconfig.build.json       extends tsconfig.app.json
```

## Schema

The schema is the roadmap's data model plus what the frontend model gained in phase 1. The full schema and the reason for each change are in [the plan](phase-3-database-plan.md#schema); in short:

| Addition | Why |
| --- | --- |
| `Zone.position` | Legend order. In the frontend it is the order of `FloorPlan.zones`; table rows have no order. |
| `Zone.hitPadding`, `Zone.label` | Added to the frontend model in phase 1. `null` hit padding means the frontend default (20). |
| `FloorPlan.viewBox Float[]` | Always four numbers: a typed Postgres array instead of JSON. |
| `Lang` enum | Only `en` and `ru`; the database rejects anything else. |
| `ZoneType` mapped to the frontend's strings | The database stores `meeting-room`; the Prisma client calls it `MEETING_ROOM`. |

The migration was checked by reading its SQL: both enums, `ON DELETE CASCADE` from plans to zones and from zones to content, the `(zoneId, lang)` primary key of `ZoneContent` and the index on `Zone.planId`.

**`viewBox` must have exactly four values.** Prisma cannot declare a CHECK constraint, so `CHECK (cardinality("viewBox") = 4)` is written by hand into the init migration, with a comment. Prisma does not report it as drift and leaves it alone in later migrations.

## Seed

`npm run db:seed` loads the demo office. It imports `demoPlan` from `frontend/src/data/demoPlan.ts`, so the office has one source until phase 4 moves the data into the backend.

- **Fixed UUIDs.** The plan is `00000000-0000-4000-8000-000000000001`, and the zones `…0101` to `…0105`, mapped from the frontend ids in `DEMO_ZONE_IDS`. A zone added to `demoPlan` without an id there stops the seed with an error, and a test names it.
- **Safe to run again.** One transaction deletes the demo plan, if present, and recreates it; zones and content cascade. Other plans are not touched.
- **Run with `tsx`.** The generated client imports with `.js` extensions, which Node's own type stripping cannot follow.

Checked on an empty volume: `db:up`, `db:deploy` and `db:seed` create the three tables and one plan with 5 zones and 10 content rows. After a second seed it is still one plan, with the same ids.

## API

**`PrismaService`** extends the generated `PrismaClient`. It builds the `PrismaPg` adapter from the validated `DATABASE_URL`, read from `ConfigService`. `PrismaModule` is global, so feature modules inject `PrismaService` without importing it, and the app shares one connection pool.

- **It connects on the first query, not at startup.** The API therefore starts while the database is down and reports it through health, instead of exiting.
- **It disconnects on shutdown.** `onModuleDestroy` calls `$disconnect()`. `main.ts` enables shutdown hooks, so this also runs on `SIGTERM` (`docker stop`, the hosting platform), not only on `app.close()`.

**`GET /api/health`** pings the database with terminus's `PrismaHealthIndicator` and a one-second timeout:

```
200 {"status":"ok","info":{"database":{"responseTime":30,"status":"up"}},"error":{},"details":{…}}
503 {"status":"error","info":{},"error":{"database":{"message":"Connection terminated unexpectedly","responseTime":8,"status":"down"}},…}
```

Checked on the running API: `200` with Postgres up, `503` after `docker stop`, and `200` again after `docker start`, without restarting the API.

## Databases

| Database | Used by | Created by |
| --- | --- | --- |
| `lzc` | `npm run dev:backend`, `db:seed`, `db:studio` | the Postgres container (`POSTGRES_DB`) |
| `lzc_test` | e2e tests, locally | `prisma migrate deploy` in the e2e global setup, which creates a missing database |
| `lzc_test` | e2e tests, CI | the Postgres service container |

`vitest.config.e2e.ts` points `DATABASE_URL` at `lzc_test` unless it is already set, so the e2e tests never touch development data. Locally they need `npm run db:up` first.

## Scripts

| Script (backend; root aliases with the same name) | Does |
| --- | --- |
| `db:migrate` | `prisma generate && prisma migrate dev`: create a migration from schema changes, apply it locally and regenerate the client. Arguments go to `migrate dev` (`npm run db:migrate -- --name add_x`). |
| `db:deploy` | `prisma migrate deploy`: apply committed migrations, no prompts |
| `db:seed` | `prisma db seed`: load the demo office |
| `db:studio` | `prisma studio`: browse the data |
| `postinstall` | `prisma generate` |

## Tests and CI

| Suite | Covers |
| --- | --- |
| `src/config/env.spec.ts` (15) | unchanged from phase 2 |
| `src/prisma/prisma.service.spec.ts` (2) | the adapter gets `DATABASE_URL` from the config; `onModuleDestroy` disconnects. No database. |
| `test/seed.e2e-spec.ts` (4) | every demo zone has a fixed id; the stored plan, read back into the frontend's shape, equals `demoPlan` (shapes, colors, `zIndex`, legend order, `hitPadding`, labels, both languages); a second seed keeps one plan and its ids; other plans survive a reseed |
| `test/health.e2e-spec.ts` (4) | health is `200` with `database: up`; `503` with `database: down` against an unreachable database; the `/api` prefix; unknown routes are `404` |

The seed test derives its expectations from `demoPlan` instead of hard-coding five zones, so it stays valid when the demo office changes. The `503` test replaces `PrismaService` with a client for `localhost:1`; it cannot change `DATABASE_URL`, because the environment is validated once per process.

Mutation checks: the tests fail when the URL is hard-coded instead of read from the config, when `$disconnect()` is removed, and when health checks nothing.

**CI.** The backend job (`Backend — lint, typecheck, test, build`, name unchanged) has a `postgres:18-alpine` service with the `lzc_test` database and a `pg_isready` healthcheck, so the steps start only when Postgres is ready. `DATABASE_URL` is set for the whole job. A separate "Apply migrations" step runs `db:deploy` before the e2e tests. The e2e setup would apply them too, but a broken migration then fails a step named after it.

Before the push, the workflow passed `actionlint`, and the whole backend job ran in Linux containers (`postgres:18-alpine` and `node:24` on one Docker network) on a clean copy of the repo without `.env`: install with client generation, lint, typecheck, 17 unit tests, migrations, 8 e2e tests and build.

## Findings

- **terminus's `PrismaHealthIndicator` works with Prisma 7.** It first sends the MongoDB command `$runCommandRaw({ ping: 1 })`, and falls back to `SELECT 1` when the error says "Use the mongodb provider". The Prisma 7 runtime still produces that error, so the planned fallback, an own `SELECT 1` indicator, was not needed.
- **Prisma reports an unreachable database differently on Windows and Linux.** The same query against a closed port fails with code `ECONNREFUSED` on Windows and with `P2010` (`DatabaseNotReachable` in `meta`) on Linux, with `localhost` and `127.0.0.1` alike. The first unit test asserted `ECONNREFUSED`: it passed on Windows and failed in the Linux simulation of CI. It now checks the URL passed to the adapter, without any connection.
- **`prisma migrate dev` no longer runs `prisma generate`** in Prisma 7, so `db:migrate` runs both.
- **`prisma init` was not used.** Version 7.10 also downloads an `.agents/` folder of AI agent skills into the project. The config and schema were written by hand.
- **The seed and the tests could not be type-checked with the app's settings.** The app follows Node's ESM rules (`nodenext`: imports need extensions, files stay inside `backend/`), but the seed imports the frontend's demo plan, which uses extensionless imports. The TypeScript config was split like the frontend's: `tsconfig.app.json` for `src/`, and `tsconfig.tools.json`, with bundler resolution and the repo root as `rootDir`, for the code that tsx and Vitest run.

## Deviations from the plan

- The TypeScript config split was added in step 3; the plan records it.
- The health response also has `responseTime` per check, and `error` and `details` objects, so the e2e tests match the body partially.
- `PrismaService` connecting lazily and `enableShutdownHooks()` were not in the plan; they follow from "the API starts with the database down" and "disconnects on shutdown".
- The step 4 unit test was rewritten in step 5 (see Findings), in its own commit.
- The roadmap gained an open question during this phase: the background of plans other than the demo office. It is decided when planning phase 4.

## Known gaps

- **CI with Postgres has not run on GitHub yet.** CI runs on pull requests; the first run is this phase's PR.
- **No endpoint reads plans.** Phase 4 adds `GET /api/plans/:id`, and the frontend switches from the static `demoPlan` to the API.
- **The seed reads the frontend's file.** The demo plan moves into the backend in phase 4.
- **`shape` and `label` are unvalidated JSON.** The API validates them in phase 5; until then only the seed writes them.
- **A `503` health response includes the driver's error message**, such as "Connection terminated unexpectedly". It holds no secrets; this is terminus's default.
- **Zone ids are UUIDs now**, which affects the frontend's marker strokes and the reception hint. See the [notes for phase 4](phase-3-database-plan.md#notes-for-phase-4) and the roadmap's [open questions](phase-0-roadmap.md#open-questions).
