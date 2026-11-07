# Phase 8 — Docker

Part of the [roadmap](phase-0-roadmap.md). The plan and its decisions are in [phase-8-docker-plan.md](phase-8-docker-plan.md).

`npm run stack:up` builds and starts the whole app in containers: PostgreSQL, the migrations, the API, and nginx serving the frontend and forwarding `/api`. It opens at http://localhost:8080 and works as in development, live updates included.

This is a local full stack and the base for phase 9's images. It is not a deployment: the credentials are development ones, and nothing makes the app safe to expose ([open questions 1 and 2](phase-0-roadmap.md#open-questions)).

The application's code did not change. Only the seed got a mode that loads the demo office if it is missing. The showcase served by nginx is byte-identical to the one under Vite (see [Checks](#checks)).

## The stack

```
db       postgres:18-alpine          127.0.0.1:${DB_PORT:-5432}, the data volume
migrate  backend/Dockerfile, tools   once on every start: migrations, then a missing demo office
api      backend/Dockerfile          not published; waits for migrate to succeed
web      frontend/Dockerfile         127.0.0.1:${WEB_PORT:-8080}; waits for api to be healthy
```

| Script | Does |
| --- | --- |
| `stack:up` | builds and starts everything, and returns once it is healthy |
| `stack:seed` | resets the demo office to its original state |
| `stack:logs` | follows the logs |
| `stack:down` | stops everything; the data is kept |

- **One Compose file and one data volume** for the stack and for development. `db:up` still starts only Postgres, and development data shows in the stack. The stack's API and one started with `npm run dev:backend` do not share their rooms, so run one at a time.
- **The demo office is loaded on start only if it is missing.** Edits to it survive restarts, a deleted one comes back, and `stack:seed` resets it. `npm run db:seed` replaces it, as before; `-- --if-missing` gives the new mode.
- **Healthchecks.** `api` calls `/api/health` with Node's `fetch`, which also checks the database; the slim image has no `curl`. `web` fetches its own `/` with `wget` on `127.0.0.1`.
- **Ports on `127.0.0.1` only.** Postgres's password is a development one, and only nginx is published for the app. The page, REST, the socket and Swagger UI (http://localhost:8080/api/docs) share one origin, so there is still no CORS.
- **`VITE_PLAN_ID`** reaches the frontend's build as an argument. Changing it means rebuilding `web`.

## Images

Both are built from the repo's root, for its one lockfile. `.dockerignore` lets in only `package.json`, the lockfile, `backend/` and `frontend/`, without any `node_modules`, `dist` or `.env`.

| Image | Stages | Size |
| --- | --- | --- |
| API, `backend/Dockerfile` | `build` (all dependencies, `prisma generate`, `nest build`) → `runtime`: `dist` and production dependencies | 551 MB |
| migrations, the same file | `tools` = `build` with `node_modules/.bin` on the `PATH` | 1.6 GB |
| frontend, `frontend/Dockerfile` | `build` (`vite build`) → `nginxinc/nginx-unprivileged:1.30-alpine` | 91 MB |

- **Base images** are pinned to a minor release: `node:24.22-slim` (Debian) and nginx 1.30. Both containers run as non-root (`node`, `nginx`).
- **The API starts with `node dist/main.js`,** not through npm, so `SIGTERM` reaches Node: `docker stop` takes under a second.
- **The API's production install** is `npm ci -w backend --omit=dev --ignore-scripts --legacy-peer-deps` (see [Findings](#findings)). `node_modules` holds 165 packages and 166 MB, without `prisma`, `tsx`, `typescript` or `vite`.

## nginx

`frontend/nginx.conf` replaces the image's default server:

- **`/api/`** goes to the API, with the WebSocket upgrade headers. Socket.IO's 25 s pings keep the socket inside nginx's 60 s read timeout.
- **Docker's DNS is asked again** every 10 s (`resolver 127.0.0.11` and a variable in `proxy_pass`), so a recreated API container is found at its new address.
- **Everything else is the app:** `try_files $uri /index.html`, so a reload of any page works. A missing file under `/assets/` is a `404`.
- **Caching:** `/assets/` for a year as `immutable`, but not a `404` there. Everything else is `no-cache`, so a new build reaches people at once.
- **`gzip` at level 6:** the 517 kB bundle arrives as 162 kB.
- **`absolute_redirect off`,** so that the redirect from `/api` to `/api/` keeps the port the browser used.
- **`X-Content-Type-Options: nosniff`** and no nginx version in responses.

## Code layout

```
.dockerignore
docker-compose.yml                db, migrate, api, web
backend/
├── Dockerfile                    build, tools, runtime
└── prisma/seed.ts, demo-plan.ts  --if-missing
frontend/
├── Dockerfile                    build, runtime
└── nginx.conf
```

## Checks

Every check of the stack ran in throwaway Compose projects, with their own volumes and ports, so development data was never touched.

| Check | Result |
| --- | --- |
| A fresh start on an empty volume | `stack:up` returned 0 in 54 s with the images cached; migrations applied, the demo office loaded, the page and Swagger UI answer |
| Starting again | "No pending migrations", the demo office "already there; left as it is" |
| `down`, then `up` | an edit to the demo office survived |
| The demo office deleted | back on the next start |
| `stack:seed` | the demo office reset |
| Postgres stopped | `/api/health` answers `503` at once; the container turned unhealthy after 58 s, and healthy 3 s after Postgres returned |
| A broken `DATABASE_URL` | `stack:up` fails with "DATABASE_URL must be a URL address" in the API's log; `web` is not started |
| A failing migration | `stack:up` fails; neither `api` nor `web` is started |
| `docker stop api` | 0.7–1.4 s, exit code 0 |
| The API's image | no `prisma`, `tsx`, `typescript`, `vite` or `.env` |

**nginx,** with an API container on a temporary database:

- `/` and a reload of `/plans/:id/edit` give `index.html`, `no-cache`;
- assets come `immutable` and compressed, and a missing one is an uncached `404`;
- `/api/plans/<unknown>` is the API's `404`;
- the socket upgrades with `101`, and stays connected through 70 s without events;
- the API recreated at a new address (`.3` → `.5`): the page reconnected in 8 s, with nginx untouched. The same config with a plain `proxy_pass` answered `502` after the move.

**In the browser.** Headless Edge with real mouse and keyboard events through the DevTools protocol, phase 7's two passes, both against the stack on its own port:

- two editors and the showcase: a drag, a resize, adding and deleting a zone, renaming and resizing the plan. Each followed in the other editor and on the showcase, with no page reloaded;
- the API container recreated while the pages were open: events arrived again 7 s later;
- the plan deleted on the plans page of another tab: "not found" in the editor, the error state on the showcase;
- a shape and a color from two tabs both survive, typed text stays, and a selected zone deleted elsewhere gives the message;
- the API stopped: the paused message, and a change made in the database meanwhile shows once the API is back.

**The showcase.** The 18 screenshots from nginx and from Vite's preview of the same build, both on the stack's database, in turns, twice each: 18 of 18 identical in every pairing.

**Development.** `db:up` recreated the development container with its port on `127.0.0.1`, keeping the data; the API on the host connects. Frontend 235 tests; backend 43 unit and 64 e2e (62 after phase 7).

**The seed's new mode** has two e2e tests: it loads a missing demo plan, and leaves an edited one as it is. Each fails when the check for an existing plan is removed or always true.

## Findings

- **`--omit=dev` kept the dev tools.** `@prisma/client`, `@nestjs/swagger` and `vite` (pulled in by a peer) name `prisma`, `typescript` and `tsx` as optional peers, so the lockfile does not count them as dev dependencies. The API's `node_modules` had 317 packages and 501 MB. `--omit=peer` changed nothing. `--legacy-peer-deps` ignores peers and installs 165 packages, 166 MB, still at the lockfile's versions; the peers the API needs are its own dependencies.
- **Prisma's CLI wants `openssl`** to pick its schema engine. Without it, migrations ran but warned that it had guessed. The API itself needs no engine: it talks to Postgres through `@prisma/adapter-pg`.
- **The frontend's `build` script fails in its image.** It runs `tsc -b` first, which also checks the tests, and one of them reads the demo plan from `backend/prisma`. The image runs `vite build` alone; types and tests are CI's job.
- **nginx resolves a plain `proxy_pass` once.** A recreated API container at a new address stayed unreachable (`502`) until nginx restarted.
- **nginx's defaults needed changes:** gzip level 1 left the bundle at 191 kB, an `add_header ... always` also cached a `404` for a year, and the redirect from `/api` named nginx's own port.
- **`docker compose up --wait` with a one-shot service works** in Compose 2.40: it returns once `api` and `web` are healthy and `migrate` exited with 0.
- **The first build needs Docker Hub, and so does every later one** while a base image is only in BuildKit's cache: it asks the registry for the image's metadata each time. With Docker Hub and DNS failing for a while, one build hung for over an hour and another failed at once. Pulling the base images (`docker pull`) made later builds work from the local store.

## Deviations from the plan

- **The demo office is seeded on start if missing,** not by an explicit command. Changed while the plan was confirmed, before the work started.
- **The API's image holds `frontend/package.json`.** `npm ci` checks the lockfile against every workspace, so the file is needed, though no frontend code is.
- **The frontend's image runs `vite build`,** not `npm run build` (see [Findings](#findings)).
- **The screenshots compared nginx with Vite's preview of the branch, not of `main`.** The frontend did not change in this phase (no difference from `main` in `frontend/src`, `index.html` or `vite.config.ts`), so the build is the same.
- **`--legacy-peer-deps`, `openssl` and nginx's three changes** were not in the plan; they came from the checks.

## Known gaps

- **CI does not build the images** yet, so a broken Dockerfile goes unnoticed until phase 9.
- **The migrations' image is 1.6 GB.** It holds every build dependency, while it needs only the CLI, `tsx` and the client. It is not published, so this matters only once phase 9 pushes images.
- **An unhealthy API is not restarted.** Docker restarts containers that exit, not those that fail their healthcheck. While Postgres is down the API answers `503` and recovers by itself when it returns.
- **Development credentials and an open Swagger UI;** no TLS or CSP. Phase 9 settles these with [open questions 1 and 2](phase-0-roadmap.md#open-questions).
- **The stack and development share the database** (decision 3), and two APIs on it do not share live updates.
- **One API instance:** rooms live in its memory ([phase 7](phase-7-realtime.md#known-gaps)).
- **Vite's 500 kB warning stays** (decision 6). The bundle arrives as 162 kB compressed.
