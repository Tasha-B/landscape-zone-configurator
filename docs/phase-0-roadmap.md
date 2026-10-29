# Phase 0 — Roadmap

This plan grows the SpaceMapper from a static map into a fullstack zone editor. Plans and zones will live in PostgreSQL, be edited through a REST API and be synced live between viewers over WebSockets. Everything will be packaged in Docker and checked by GitHub Actions.

```
React / TS frontend ──REST + WebSockets──▶ NestJS API ──▶ PostgreSQL
        └──────────── packaged with Docker ────────────┘
                              │
                     CI/CD: GitHub Actions
```

## Stack

| Concern | Choice | Why |
| --- | --- | --- |
| Framework | **NestJS 12**, TypeScript 6, ESM | modules, dependency injection, guards and pipes; the common structure for Node APIs |
| Database | **PostgreSQL 18** | relational data plus `jsonb` for zone geometry |
| ORM / migrations | **Prisma** | the schema is code, the client is typed, migrations and seeding come built in |
| Validation | `class-validator` + global `ValidationPipe` | standard in Nest; DTOs also document the API |
| API docs | `@nestjs/swagger` (OpenAPI) | Swagger UI, and frontend types generated with `openapi-typescript`, so one contract serves both apps |
| Realtime | `@nestjs/websockets` + Socket.IO | broadcasts zone changes to everyone viewing a plan |
| Config | `@nestjs/config` with env validation | the app refuses to start with a broken `.env` |
| Health | `@nestjs/terminus` → `/api/health` | used by Docker healthchecks and the hosting platform |
| Tests | Vitest (unit) + Supertest (e2e against a real Postgres) | the same runner as the frontend; e2e runs in CI against a Postgres service container |
| Frontend data layer | TanStack Query | caching, loading and error states, optimistic updates |

NestJS 12, Vitest and PostgreSQL 18 replaced the originally planned NestJS 11, Jest and PostgreSQL 17 in phase 2, when the current releases came out ([phase-2-backend-scaffold.md](phase-2-backend-scaffold.md)).

## Data model

```
FloorPlan     id uuid · name · viewBox · pxPerMeter · createdAt · updatedAt
   │ 1:N
Zone          id uuid · planId · type (enum) · shape jsonb · color · zIndex · version · createdAt · updatedAt
   │ 1:N
ZoneContent   (zoneId, lang) PK · name · tagline · recommendation · rationale
```

Prisma sketch:

```prisma
model FloorPlan {
  id         String   @id @default(uuid()) @db.Uuid
  name       String
  viewBox    Json     // [minX, minY, width, height]
  pxPerMeter Float
  zones      Zone[]
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
}

enum ZoneType {
  RECEPTION
  MEETING_ROOM
  OPEN_FLOOR
  BREAK_ROOM
  SIGNATURE_CORNER
  CUSTOM
}

model Zone {
  id        String        @id @default(uuid()) @db.Uuid
  plan      FloorPlan     @relation(fields: [planId], references: [id], onDelete: Cascade)
  planId    String        @db.Uuid
  type      ZoneType
  shape     Json          // { kind: "rect", ... } | { kind: "circle", ... } | { kind: "polygon", ... }
  color     String
  zIndex    Int
  version   Int           @default(1)
  content   ZoneContent[]
  createdAt DateTime      @default(now())
  updatedAt DateTime      @updatedAt

  @@index([planId])
}

model ZoneContent {
  zone           Zone   @relation(fields: [zoneId], references: [id], onDelete: Cascade)
  zoneId         String @db.Uuid
  lang           String // "en" | "ru"
  name           String
  tagline        String
  recommendation String
  rationale      String

  @@id([zoneId, lang])
}
```

Design decisions:

- **Derived data is not stored.** Marker strokes, label positions and area are computed on the frontend from `shape` and `pxPerMeter`. A zone moved in the editor stays consistent automatically.
- **`shape` is `jsonb`.** A zone is always read and written as a whole shape, never queried by individual coordinates. It is validated at the API boundary with a DTO per `kind`.
- **Optimistic concurrency.** `PATCH` sends the `version` it was based on. If the stored version differs, the API returns `409 Conflict`; otherwise it increments the version.

## API

```
GET    /api/plans                 list plans
GET    /api/plans/:id             plan with zones and content
POST   /api/plans                 create a plan
PATCH  /api/plans/:id             update a plan
DELETE /api/plans/:id             delete a plan (zones cascade)
POST   /api/plans/:id/zones       add a zone
PATCH  /api/zones/:id             update a zone (requires version, 409 on conflict)
DELETE /api/zones/:id             delete a zone
GET    /api/health                healthcheck
GET    /api/docs                  Swagger UI
```

WebSocket namespace `/plans`:

- the client emits `join { planId }` and is placed in the room `plan:<id>`;
- the server emits `zone.created`, `zone.updated` and `zone.deleted` to that room.

REST stays the source of truth. The gateway only broadcasts changes that have already been saved, so a client that misses an event recovers by refetching.

## Phases

| Phase | Scope | Result |
| --- | --- | --- |
| 1 | **Single `Zone` model on the frontend** | `zoneShapes`, `zoneMarkerGroups`, `zoneLabelInfo`, `zoneHoverColor` and `zoneData` merged into `Zone[]`; markers, labels and area computed; geometry utilities unit-tested. This is the contract the database follows, so it comes first. |
| 2 | **Backend scaffold** | `backend/` from `nest new`, npm workspaces at the root, `docker-compose.yml` with Postgres for local development, env validation, `/api/health` |
| 3 | **Database** | Prisma schema, first migration, seed with the current five zones |
| 4 | **Read path** | `GET /plans/:id`, Swagger, generated types; the frontend fetches the plan through TanStack Query instead of importing static data |
| 5 | **CRUD** | create, update and delete for plans and zones, DTO validation, `409` on version conflict, e2e tests |
| 6 | **Editor on the frontend** | edit mode with drag, resize, add and delete zone; saving through `PATCH` with optimistic updates and rollback |
| 7 | **WebSockets** | plan rooms and broadcast after each mutation; the frontend patches the TanStack Query cache from events |
| 8 | **Docker** | multi-stage `Dockerfile` for the API, frontend built and served by nginx, `docker-compose` for the full stack with healthchecks and migrations run on start |
| 9 | **CI/CD** | GitHub Actions on every PR: lint, typecheck, unit and e2e tests (Postgres service), build images; on `main`, push images to GHCR and optionally deploy (Render / Fly.io / Railway) |
| 10 | *Optional:* **auth** | JWT, every plan has an owner, read-only sharing links |

Phases 8 and 9 can move up to right after phase 3. Every PR after that then goes through CI, which shows the DevOps side of the project from early on.

## Open questions

Questions that are not decided yet but block a later phase. Each one is settled in the plan of the phase named in it, and moves into that plan's decisions.

### 1. The background of plans other than the demo office

*Raised 2026-10-29. Decide when planning phase 4, before phase 6 at the latest.*

Zones are data, but everything around them is not. Walls, doors, furniture, trees and the "tap a zone" arrow are static SVG in `PlanBackground.tsx`, drawn for the demo office. A second plan, created through the API (phase 5) or the editor (phase 6), would get its own zones but the demo office's walls behind them. This roadmap originally listed walls as data as out of scope, because it assumed a single office.

Options:

| Option | What it takes | Trade-off |
| --- | --- | --- |
| A. Background image per plan | Upload an SVG or PNG floor plan, stored with the plan and drawn under the zones, scaled to its `viewBox` | Works with any existing drawing; the background cannot be edited in the app |
| B. Walls as data | New models for walls, doors and furniture, drawn and edited like zones | Fully editable and consistent in style; a large addition to the data model, the API and the editor |
| C. Blank sheet | Plans other than the demo show their zones on the paper texture only | No extra work; a plan without walls is hard to read |

A starting point is to begin with C or A and keep B for later. The demo office stays as it is in every option.

Related: the reception hint is also tied to the demo office artwork, and marker strokes are seeded by zone id. Both are described in the notes for phase 4 in [phase-3-database-plan.md](phase-3-database-plan.md).

## Docs naming

Each phase gets its own docs in `docs/`, named after its number and slug:

- `phase-N-<slug>-plan.md` is the detailed plan, written before the work starts;
- `phase-N-<slug>.md` records what was built and why, written when the phase is done.

| Phase | Slug |
| --- | --- |
| 0 | `frontend-port`, `roadmap` |
| 1 | `zone-model` |
| 2 | `backend-scaffold` |
| 3 | `database` |
| 4 | `read-api` |
| 5 | `crud` |
| 6 | `editor` |
| 7 | `realtime` |
| 8 | `docker` |
| 9 | `ci-cd` |
| 10 | `auth` |

## Target repository layout

```
.
├── frontend/              React app
├── backend/               NestJS API
│   ├── prisma/            schema, migrations, seed
│   └── src/
│       ├── plans/         module, controller, service, DTOs
│       ├── zones/
│       ├── realtime/      WebSocket gateway
│       └── health/
├── docs/
├── docker-compose.yml
├── package.json           npm workspaces + root scripts
└── .github/workflows/ci.yml
```
