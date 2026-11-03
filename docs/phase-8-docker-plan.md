# Phase 8 — Docker: plan

Part of the [roadmap](phase-0-roadmap.md). The result will be recorded in `phase-8-docker.md`.

## Goal

One command starts the whole app in containers: PostgreSQL, the API and the frontend behind nginx, with migrations applied on start and healthchecks on every service. The app looks and works as it does in development, live updates included.

This is a local full stack and the base for phase 9's images. It is not a deployment: nothing here makes the app safe to expose ([open questions 1 and 2](phase-0-roadmap.md#open-questions)).

## Where we are

- `docker-compose.yml` runs only Postgres, for development. `npm run db:up` starts that service by name, and `db:down` stops everything in the file.
- **The API** builds to `backend/dist` and starts with `node dist/main.js`. It validates its environment at startup, and closes cleanly on `SIGTERM`. `/api/health` checks the database.
- **The generated Prisma client** lives in `backend/src/generated`, so `nest build` compiles it into `dist`. At run time the API needs only production dependencies. `npm install` runs `prisma generate` through `postinstall`, which needs the CLI, a dev dependency.
- **`prisma migrate deploy` and the seed** need dev dependencies (`prisma`, `tsx`). The seed imports only types from the frontend, so its code does not need `frontend/`.
- **The seed replaces the demo plan** on every run, and leaves other plans alone.
- **The frontend** is static files, and calls `/api` and `/api/socket.io` on its own origin. `VITE_PLAN_ID` is read at build time.
- **One lockfile in the root** covers both workspaces, so each image is built from the repo's root.
- `node_modules` on the host is Windows-only and must not reach an image. `backend/.env` must not either.

## Decisions taken before the plan

*(Decided 2026-11-03.)*

1. **Migrations run in a one-shot `migrate` service,** not in the API's start command. The API waits for it to finish. The API's image then has no CLI and no dev dependencies, and a failed migration shows up as that service's failure, not as a crashing API.
2. **The demo office is seeded on start only if it is missing.** A fresh stack shows it at once, and edits survive restarts, which a full seed on every start would undo, also for development through the shared volume (decision 3). A demo office deleted on purpose comes back at the next start. `npm run stack:seed` resets it by hand. Whether a deployment resets it by itself belongs to [open question 1](phase-0-roadmap.md#open-questions).
3. **One Compose file, one data volume.** `api`, `migrate` and `web` join `docker-compose.yml`, and the stack and development share the database. `db:up` keeps starting only Postgres. The alternative, a separate file and volume, keeps the two apart but means two sets of data and longer commands.
4. **Only nginx is published,** at `127.0.0.1:8080`, and it forwards `/api`. The page, REST, the socket and Swagger UI share one origin, so there is still no CORS. Postgres's published port also moves to `127.0.0.1`, since its password is a development one.
5. **Debian-based Node images (`node:24.22-slim`) and unprivileged nginx (`nginxinc/nginx-unprivileged`, Alpine).** The lockfile has musl builds of the native packages, so Alpine Node would likely work, but Prisma's schema engine and the native tools are simplest on glibc. Both containers run as non-root.
6. **No code-splitting in this phase.** nginx compresses the 517 kB bundle to about 163 kB. Splitting the editor off would make the showcase load differently, so it needs its own change and its own screenshots. Vite's warning stays.

## Images

The build context of both is the repo's root. A `.dockerignore` there lets in only what the builds need, and keeps out every `node_modules`, `dist` and `.env`:

```
*
!package.json
!package-lock.json
!backend/
!frontend/
**/node_modules
**/dist
**/*.tsbuildinfo
**/.env
**/.env.*
!**/.env.example
```

### `backend/Dockerfile`

| Stage | From | Holds |
| --- | --- | --- |
| `build` | `node:24.22-slim` and `openssl` | every dependency of the workspace (`npm ci -w backend`), which also runs `prisma generate`; `nest build` |
| `tools` | `build` | used by `migrate`: the CLI, `tsx`, the schema, the migrations and the seed |
| `runtime` (last) | `node:24.22-slim` | `dist` and production dependencies (`npm ci -w backend --omit=dev --ignore-scripts --legacy-peer-deps`) |

- **`--ignore-scripts` in `runtime`,** because `postinstall` would call the CLI that `--omit=dev` removed. The generated client is already in `dist`.
- **`--legacy-peer-deps` in `runtime`.** Optional peers of `@prisma/client`, `@nestjs/swagger` and `vite` mark `prisma`, `typescript`, `tsx` and `vite` as more than dev dependencies, so `--omit=dev` alone keeps them, and `--omit=peer` does not help. Ignoring peers takes `node_modules` from 501 to 166 MB, with versions still from the lockfile. The peers the API needs are its own dependencies.
- **`CMD ["node", "dist/main.js"]`,** not `npm start`, so that `SIGTERM` reaches Node, as the shutdown hooks expect.
- **`USER node`,** with `NODE_ENV=production`.
- **`openssl` in `build`.** Without it the CLI warns that it cannot tell which schema engine to use. The API itself needs no engine: it talks to Postgres through `@prisma/adapter-pg`.

### `frontend/Dockerfile`

| Stage | From | Holds |
| --- | --- | --- |
| `build` | `node:24.22-slim` | `npm ci -w frontend`, `npm run build -w frontend`, with `VITE_PLAN_ID` as an optional build argument |
| `runtime` (last) | `nginxinc/nginx-unprivileged` (Alpine) | `dist` and `nginx.conf`, listening on 8080 |

Image versions are pinned to a minor release. `.nvmrc` stays Node's source of truth for CI, and the Dockerfiles name the same major version.

### `frontend/nginx.conf`

- **`/api/`** goes to the API, with the WebSocket upgrade headers and `proxy_http_version 1.1`. Socket.IO pings every 25 s, inside nginx's 60 s read timeout, so that timeout stays.
- **Docker's DNS on each request** (`resolver 127.0.0.11` and a variable in `proxy_pass`). Without it, nginx keeps the API's address from its own start, and a recreated API container that gets a new address stays unreachable until nginx restarts.
- **The other paths** are the app: `try_files $uri /index.html`, so `/plans/:id/edit` survives a reload. A missing file under `/assets/` is a `404`, not the page.
- **Caching:** `/assets/` has hashed names and is cached for a year, as `immutable`. `index.html` is `no-cache`, so a new build reaches people at once.
- **`gzip`** for JavaScript, CSS, SVG and JSON.
- **`X-Content-Type-Options: nosniff`.** Other security headers, such as a CSP, wait for a real deployment in phase 9.

## Compose

```
db       postgres:18-alpine   as now; port on 127.0.0.1
migrate  backend, tools       migrations, then a missing demo office, once   after: db healthy
api      backend, runtime     not published                   after: migrate completed
web      frontend, runtime    127.0.0.1:${WEB_PORT:-8080}     after: api healthy
```

- **Healthchecks.** `api` calls `/api/health` with Node's `fetch`, since the slim image has no `curl`. `web` calls its own `/` with `wget`, on `127.0.0.1`, because `localhost` can resolve to IPv6 first.
- **`restart: unless-stopped`** on `db`, `api` and `web`, not on `migrate`.
- **The seed's new mode.** `prisma db seed -- --if-missing` loads the demo office only if its plan does not exist. Without the flag the seed replaces it, as today, so `db:seed` does not change. A failing migration or seed stops `api` from starting.
- **The API's `DATABASE_URL`** names the `db` service. The development credentials stay in the file, as today; phase 9 supplies real ones.

New root scripts:

| Script | Does |
| --- | --- |
| `stack:up` | builds and starts everything, and waits until it is healthy |
| `stack:seed` | resets the demo office to its original state, in a one-off `migrate` container |
| `stack:logs` | follows the logs |
| `stack:down` | stops everything; the data is kept |

`docker compose up --wait` has had trouble with one-shot services that exit, so step 4 checks that `stack:up` reports success on a healthy start with this Compose version.

**Against development:** the stack's API and one started with `npm run dev:backend` would share the database but not their rooms, so a change made through one sends no event to viewers of the other. Run one at a time. Ports do not collide: the stack publishes 8080, and development uses 3000 and 5173.

## Code layout

```
.dockerignore
docker-compose.yml           migrate, api, web join db
backend/Dockerfile
frontend/
├── Dockerfile
└── nginx.conf
```

The application's code does not change; only the seed gets its new mode.

## Checks

There is nothing here for unit tests to cover, so the checks run against the real stack:

- **A fresh start.** With an empty volume (a temporary Compose project, so that the development data stays untouched): `stack:up` succeeds, the migrations are applied, and the showcase shows the demo office.
- **Restarts:** data survives `stack:down` and `stack:up`, and `migrate` does nothing the second time: an edited demo office stays edited. A deleted one comes back, and `stack:seed` undoes edits.
- **Failures:**
  - a broken `DATABASE_URL` stops `api` with the validation message, and `web` does not start;
  - a failing migration stops `api` from starting;
  - `/api/health` turns the container unhealthy while `db` is stopped.
- **The images:**
  - the API's has no `prisma`, `tsx` or `.env`, and no `frontend/`;
  - both run as non-root;
  - `docker stop api` ends within a second or two, not at the 10 s kill;
  - the image sizes are recorded.
- **nginx:**
  - a reload of `/plans/:id/edit` works, a missing asset is a `404`, and `/api/plans/<unknown>` is the API's `404`;
  - `/assets/` and `index.html` send the intended cache headers, and JavaScript arrives compressed;
  - the socket connects with `101`, and stays connected past 60 s with no events;
  - after `docker compose up -d --force-recreate api`, the page reconnects without restarting nginx.
- **In the browser,** through `http://localhost:8080`: phase 7's pass with two editors and the showcase (drag, resize, add, delete, a deleted plan, the API stopped and back).
- **The showcase:** the 18 screenshots from the stack against `main` under Vite's preview, on the same database.
- **Development still works:** `db:up`, `dev:backend`, `dev:frontend` and the e2e tests, and the port on `127.0.0.1` is reachable from the host.

## Steps

Each step is a separate commit, and both apps build after every one.

1. **Plan.** This document. Tick the last acceptance box of phase 7 (both CI jobs were green on PR #9).
2. **The API's image.** `.dockerignore`, `backend/Dockerfile`, checked with `docker build` and `docker run` against the running `db`.
3. **The frontend's image.** `frontend/Dockerfile`, `nginx.conf`, checked against a running API container.
4. **The stack.** The seed's new mode with a test, `migrate`, `api` and `web` in Compose, healthchecks, the port on `127.0.0.1`, the root scripts. The full checks above.
5. **Docs.** `phase-8-docker.md`, the roadmap, the README (running the stack).

## Acceptance criteria

- [ ] `npm run stack:up` on an empty volume builds and starts everything, and reports success once it is healthy.
- [ ] Migrations are applied on start, and a missing demo office is loaded. Edits to it survive a restart, and `stack:seed` resets it.
- [ ] The app works through `http://localhost:8080`: the showcase, the plans page, the editor, a reload on any page, and Swagger UI.
- [ ] Live updates work through nginx, and survive a recreated API container.
- [ ] `/` looks as under Vite: the screenshots are byte-identical.
- [ ] Data survives `stack:down` and `stack:up`.
- [ ] The API's image has no dev dependencies and no `.env`, and both images run as non-root.
- [ ] Development with `db:up` and `dev:*` works as before.
- [ ] Both CI jobs are green.

## Out of scope

- Building images in CI, pushing them and deploying: phase 9. Until then, CI does not notice a broken Dockerfile.
- Real credentials, TLS, a CSP and other production hardening: phase 9.
- Hiding Swagger UI: it stays open, as the API does. Phase 9 settles this along with [open questions 1 and 2](phase-0-roadmap.md#open-questions).
- Code-splitting (decision 6) and a dev container: development stays on the host.
- Several API instances: rooms stay in one API's memory ([phase 7](phase-7-realtime.md#known-gaps)).
