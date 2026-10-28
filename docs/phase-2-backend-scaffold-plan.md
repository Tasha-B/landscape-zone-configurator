# Phase 2 — Backend scaffold: plan

Part of the [roadmap](phase-0-roadmap.md). The result will be recorded in `phase-2-backend-scaffold.md`.

## Goal

Add a NestJS API next to the frontend. It starts, refuses to start with a broken environment, and answers `GET /api/health`. PostgreSQL runs locally in Docker. Both apps live in one npm workspace and are checked by CI.

The API does not talk to the database yet. Prisma, the schema and the seed come in phase 3. Nothing on the frontend changes.

## Where we are

- The repo holds one app, `frontend/`, with its own `package-lock.json`.
- CI has one job, `Frontend — lint, typecheck, build`, which runs inside `frontend/`. The `main` ruleset requires a check with exactly that name.
- `.nvmrc` pins Node 24. The local machine runs Node 24.11.
- Docker Desktop is installed (Docker 28.5, Compose 2.40). Port 5432 is free.

## Changes to the roadmap

The roadmap was written before these releases. The plan follows the current versions, and step 7 updates the roadmap to match.

| Roadmap says | Now | Why |
| --- | --- | --- |
| NestJS 11 | **NestJS 12** | Current major. Its packages are ESM-only. |
| Jest + Supertest | **Vitest** + Supertest | `nest new` in Nest 12 generates ESM projects with Vitest and oxlint. The frontend already uses both, so the whole repo has one test runner and one linter. |
| PostgreSQL 17 | **PostgreSQL 18** | Current major. The project starts with it, so no upgrade is needed later. *(Decided 2026-10-28.)* |
| — | Backend on **TypeScript 6** | `@nestjs/cli` 12 ships with TypeScript 6 and the template targets it. The frontend stays on TypeScript 7. Each workspace keeps its own version. |

## Target

```
.
├── package.json              workspaces: frontend, backend; root scripts
├── package-lock.json         one lockfile for the whole repo
├── docker-compose.yml        postgres:18-alpine for local development
├── frontend/                 unchanged, except that its lockfile moves to the root
└── backend/
    ├── .env.example
    ├── nest-cli.json
    ├── oxlint.json
    ├── package.json          "type": "module"
    ├── tsconfig.json
    ├── tsconfig.build.json
    ├── vitest.config.ts
    ├── vitest.config.e2e.ts
    ├── src/
    │   ├── main.ts           bootstrap
    │   ├── app.ts            configureApp(app): global prefix, shared by main.ts and e2e tests
    │   ├── app.module.ts
    │   ├── config/
    │   │   ├── env.ts        Env class + validate()
    │   │   └── env.spec.ts
    │   └── health/
    │       ├── health.module.ts
    │       └── health.controller.ts
    └── test/
        └── health.e2e-spec.ts
```

### Environment

`@nestjs/config` loads `backend/.env` and validates it at startup with `class-validator`, the library the DTOs will use from phase 5. On an invalid value the app exits and names every bad variable.

| Variable | Rule | Default |
| --- | --- | --- |
| `NODE_ENV` | `development`, `test` or `production` | `development` |
| `PORT` | integer 1–65535 | `3000` |
| `DATABASE_URL` | `postgresql://` URL, required | — |

`DATABASE_URL` is required already, although only phase 3 uses it. `.env.example` then documents the full environment from the start, and the value it holds matches the Postgres container.

### Health

`GET /api/health` uses `@nestjs/terminus` and returns `200 {"status":"ok", ...}`. In phase 2 it checks nothing external, because there is no database client yet. Phase 3 adds a Prisma ping, so the endpoint returns `503` while the database is down.

Every route lives under the `/api` prefix. It is set in `configureApp()`, which both `main.ts` and the e2e tests call, so the tests hit the same URLs as the real app.

### Local Postgres

```yaml
# docker-compose.yml (sketch)
services:
  db:
    image: postgres:18-alpine
    environment: { POSTGRES_USER: lzc, POSTGRES_PASSWORD: lzc, POSTGRES_DB: lzc }
    ports: ["${DB_PORT:-5432}:5432"]
    volumes: [pgdata:/var/lib/postgresql]   # the Postgres 18 image keeps data under a versioned subdirectory
    healthcheck: { test: ["CMD-SHELL", "pg_isready -U lzc -d lzc"], interval: 5s, retries: 10 }
volumes:
  pgdata:
```

The credentials are for local development only and are not secrets. The API and frontend containers come in phase 8.

### Root scripts

| Script | Does |
| --- | --- |
| `dev:frontend` | Vite dev server |
| `dev:backend` | `nest start --watch` |
| `db:up` / `db:down` | start / stop the Postgres container |
| `lint`, `typecheck`, `test`, `build` | run in every workspace that defines the script |

The two dev servers run in two terminals. That avoids a process runner such as `concurrently` for now.

### Code style

The backend follows the frontend: double quotes, oxlint, no Prettier. The template's Prettier config, the `format` script and `@nestjs/mau` (Nest's hosted deploy service) are removed. *(Decided 2026-10-28.)*

## Steps

Each step is a separate commit, and both apps build after every one.

0. **Before step 2, locally:** update Node to the latest 24.x (24.22.2): `nvm install 24.22.2` and `nvm use 24.22.2`. The Nest 12 generators (`nest new`, `nest generate`) need Node 24.15 or newer; at runtime Nest itself needs 20.19+. CI already gets the latest 24.x from `.nvmrc`.
1. **npm workspaces.** Add the root `package.json`, replace `frontend/package-lock.json` with one root lockfile, and install from the root in CI. Frontend lint, typecheck, test and build stay green, and the map works as before. Regenerating the lockfile can pick newer patch versions within the existing ranges. That is checked by running the frontend checks and opening the map.
2. **Backend scaffold.** Generate with `nest new` (ESM), then trim it: remove the hello-world controller and service, Prettier and `@nestjs/mau`, and switch to double quotes. Use the same Vitest major as the frontend. Check that constructor injection works in tests: Nest needs decorator metadata, and if the Vitest transform does not emit it, add `unplugin-swc`.
3. **Config.** Add `@nestjs/config`, `Env` + `validate()`, `.env.example`, and unit tests: a valid env passes, defaults apply, a missing `DATABASE_URL` and a bad `PORT` fail with their names in the message.
4. **Health.** Add `@nestjs/terminus`, `HealthModule`, `configureApp()` with the `/api` prefix, and an e2e test: `GET /api/health` returns 200 with `status: "ok"`, and `GET /health` without the prefix returns 404. The e2e config sets a test `DATABASE_URL`, so no database is needed.
5. **Postgres.** Add `docker-compose.yml` and the `db:up` / `db:down` scripts. Check: the container becomes healthy, and `psql` accepts the `DATABASE_URL` from `.env.example`.
6. **CI.** Add a second job, `Backend — lint, typecheck, test, build`, that runs unit and e2e tests. The frontend job keeps its name. After the merge, add the new job to the required checks in the `main` ruleset (GitHub → Settings → Rules).
7. **Docs.** Write `phase-2-backend-scaffold.md`. Update the roadmap (NestJS 12, Vitest, PostgreSQL 18, TypeScript 6 for the backend) and the README (stack, run instructions).

## Acceptance criteria

- [ ] `npm ci` in the root installs both apps; `frontend/package-lock.json` is gone.
- [ ] `npm run dev:backend` starts the API on port 3000, and `GET /api/health` returns `200` with `"status": "ok"`.
- [ ] With a missing or invalid `DATABASE_URL` or `PORT`, the API does not start and names the variable.
- [ ] `npm run db:up` starts Postgres 18; it becomes healthy and accepts the `DATABASE_URL` from `.env.example`.
- [ ] The frontend is unchanged: lint, typecheck, test and build are green, and the map works.
- [ ] Both CI jobs are green.

## Decisions

1. **NestJS 12 with ESM, Vitest and oxlint**, matching the frontend's toolchain. *(Decided 2026-10-28.)*
2. **PostgreSQL 18.** *(Decided 2026-10-28.)*
3. **No Prettier.** The backend uses the frontend's style. *(Decided 2026-10-28.)*
4. **The backend uses TypeScript 6**, as Nest 12 ships with it. The frontend stays on TypeScript 7.
5. **Env validation with `class-validator`**, so env and DTOs share one validation library.
6. **The health check has no indicators until phase 3**, because there is no database client before Prisma.

## Out of scope

- Prisma, the schema, migrations and the seed (phase 3).
- Any endpoint other than health; Swagger (phase 4).
- The frontend calling the API, the Vite `/api` proxy, CORS (phase 4).
- Dockerfiles for the API and the frontend (phase 8).
