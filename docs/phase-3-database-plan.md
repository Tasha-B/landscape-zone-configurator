# Phase 3 — Database: plan

Part of the [roadmap](phase-0-roadmap.md). The result is recorded in [phase-3-database.md](phase-3-database.md).

## Goal

Store floor plans and zones in PostgreSQL. Add a Prisma schema, the first migration and a seed that loads the demo office from phase 1. The API gets a database client, and `/api/health` reports the database.

No endpoint reads plans yet: that is phase 4. The frontend is unchanged.

## Where we are

- `backend/` is a NestJS 12 API (ESM, TypeScript 6) that validates `DATABASE_URL` at startup but never connects.
- `npm run db:up` starts PostgreSQL 18 locally (`lzc` / `lzc` / `lzc`).
- The demo office lives in `frontend/src/data/demoPlan.ts` as one `FloorPlan` with five zones.
- CI runs backend unit and e2e tests without a database.

## Prisma version

**Prisma 7.10.1**, pinned exactly. *(Decided 2026-10-29.)*

The `latest` tag of the `prisma` CLI on npm points to a release candidate, `8.0.0-rc.28`, while the newest stable client is `@prisma/client` 7.10.1. A plain `npm install prisma` would install the RC, which does not match the client. Prisma 8 is close to a different library: there is no client class, it has a new query API, and its NestJS example relies on explicit injection tokens. The project can move to it once it is stable.

What Prisma 7 changes compared with the setup the roadmap assumed:

| Concern | Prisma 7 |
| --- | --- |
| Client | Generator `prisma-client` writes TypeScript into `src/generated/prisma/`, not into `node_modules`. The folder is ignored by git and rebuilt by `prisma generate`. |
| Connection | A driver adapter is required: `@prisma/adapter-pg` on top of `pg`. |
| CLI config | `prisma.config.ts` holds the schema path, the migrations path, the seed command and the URL. It does not load `.env` by itself. |
| Modules | ESM, matching the backend. |

## Schema

This follows the roadmap's data model, plus the fields the frontend model gained in phase 1:

```prisma
enum ZoneType {
  RECEPTION        @map("reception")
  MEETING_ROOM     @map("meeting-room")
  OPEN_FLOOR       @map("open-floor")
  BREAK_ROOM       @map("break-room")
  SIGNATURE_CORNER @map("signature-corner")
  CUSTOM           @map("custom")
}

enum Lang {
  en
  ru
}

model FloorPlan {
  id         String   @id @default(uuid()) @db.Uuid
  name       String
  viewBox    Float[]  // [minX, minY, width, height]
  pxPerMeter Float
  zones      Zone[]
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
}

model Zone {
  id         String        @id @default(uuid()) @db.Uuid
  plan       FloorPlan     @relation(fields: [planId], references: [id], onDelete: Cascade)
  planId     String        @db.Uuid
  type       ZoneType
  shape      Json          // Shape from the frontend model: rect | circle | polygon
  color      String
  zIndex     Int           // paint and tab order
  position   Int           // legend order
  hitPadding Int?          // null = default 20
  label      Json?         // { dx, dy, fontSize?, areaDy? }
  version    Int           @default(1)
  content    ZoneContent[]
  createdAt  DateTime      @default(now())
  updatedAt  DateTime      @updatedAt

  @@index([planId])
}

model ZoneContent {
  zone           Zone   @relation(fields: [zoneId], references: [id], onDelete: Cascade)
  zoneId         String @db.Uuid
  lang           Lang
  name           String
  tagline        String
  recommendation String
  rationale      String

  @@id([zoneId, lang])
}
```

| Change from the roadmap | Why |
| --- | --- |
| `position` | In `FloorPlan.zones`, array order is the legend order. Rows in a table have no order, so the order needs a column. |
| `hitPadding`, `label` | Added to the frontend model in phase 1 (the signature corner has no hit padding; labels are offsets from the shape center). |
| `viewBox Float[]` instead of `Json` | Always four numbers. A Postgres array is typed, and a JSON blob would not be. |
| `Lang` enum instead of `String` | Only `en` and `ru` exist. The database rejects anything else. |
| `ZoneType` values mapped to the frontend's strings | The database stores `meeting-room`, exactly what the frontend uses. The Prisma client uses `MEETING_ROOM`. |

`shape` and `label` stay JSON, as the roadmap decided: they are always read and written whole. The API validates them in phase 5.

## Seed

`prisma/seed.ts` imports `demoPlan` from `frontend/src/data/demoPlan.ts`, so the demo office has one source. *(Decided 2026-10-29.)* In phase 4, when the frontend loads the plan from the API, the file moves into the backend.

- **Fixed UUIDs.** The plan and its five zones get UUIDs written in the seed, mapped from the frontend ids (`reception` → a fixed UUID). Reseeding gives the same ids, so URLs and later references stay valid.
- **Idempotent.** The seed deletes the demo plan, if present, and recreates it in one transaction. Zones and content cascade, and other plans are not touched.
- **Run with `tsx`.** The generated client is TypeScript whose imports use `.js` extensions. Node's built-in type stripping cannot run it, and `tsx` can. The seed has no decorators, so it does not need decorator metadata.
- **Type-checked as tooling.** The app follows Node's ESM rules (`moduleResolution: nodenext`), but the frontend's files use extensionless imports and live outside `backend/`. The backend's TypeScript config is split, like the frontend's: `tsconfig.app.json` checks `src/` with Node's rules, and `tsconfig.tools.json` checks the seed, tests and configs, which tsx and Vitest run, with bundler resolution. *(Added during step 3.)*

## API changes

- **`PrismaModule` (global) with `PrismaService`.** It extends the generated `PrismaClient` and builds the `PrismaPg` adapter from the validated `DATABASE_URL` (`ConfigService`, not `process.env`). It disconnects on shutdown.
- **`/api/health` pings the database** with terminus's `PrismaHealthIndicator`, or with a one-line `SELECT 1` indicator if that does not work with the Prisma 7 client. With the database up it returns `200 {"status":"ok","info":{"database":{"status":"up"}}}`; with the database down it returns `503`. *(Done: terminus's indicator works with the Prisma 7 client, so no own indicator was needed.)*

## Databases

| Database | Used by | Created by |
| --- | --- | --- |
| `lzc` | `npm run dev:backend` | the Postgres container |
| `lzc_test` | e2e tests, locally | `prisma migrate deploy` in the e2e setup |
| `lzc_test` | e2e tests, CI | the Postgres service container |

The e2e tests get their own database, so running them never wipes development data.

## Scripts

| Script (backend; root aliases with the same name) | Does |
| --- | --- |
| `db:migrate` | `prisma migrate dev`: create a migration from schema changes and apply it locally |
| `db:deploy` | `prisma migrate deploy`: apply committed migrations, no prompts (CI, tests, later Docker) |
| `db:seed` | `prisma db seed`: load the demo office |
| `db:studio` | `prisma studio`: browse the data |
| `prisma generate` | runs on `postinstall`, so the client exists after `npm install` / `npm ci` |

## Steps

Each step is a separate commit, and both apps build after every one.

1. **Prisma setup.** Install `prisma@7.10.1`, `@prisma/client@7.10.1`, `@prisma/adapter-pg`, `pg` and `tsx`. Add `prisma.config.ts`, an empty schema with the datasource and generator, `postinstall: prisma generate`, and ignore `src/generated/` in git. Check that `generate` also works in CI, where there is no `.env`.
2. **Schema and first migration.** Add the models above and run `prisma migrate dev --name init`. Commit `prisma/migrations/`. Check the SQL: enums, the cascades, the composite key of `ZoneContent`, the `planId` index.
3. **Seed.** Write `prisma/seed.ts` from `demoPlan` with fixed UUIDs. Add a test that seeds `lzc_test`, reads the plan back through Prisma and compares it field by field with `demoPlan`: shapes, colors, `zIndex`, legend order, `hitPadding`, labels, both languages.
4. **PrismaService and health.** Add `PrismaModule`, `PrismaService` and the database indicator. Unit tests run without a database; e2e tests run against `lzc_test`: health is `up` with the database and `503` with an unreachable one. *(Done. The unit test was rewritten in step 5: Prisma reports a refused connection differently on Windows and Linux.)*
5. **CI.** Add a `postgres:18-alpine` service to the backend job, run `db:deploy` before the e2e tests, and set `DATABASE_URL` to the service. The job keeps its name, which is a required check. *(Done: checked with actionlint and a Linux container run of the whole job.)*
6. **Docs.** Write `phase-3-database.md`, update the roadmap's data model with the schema changes above, and update the README (database status, `db:*` scripts).

## Acceptance criteria

- [x] `npm run db:up && npm run db:deploy -w backend && npm run db:seed -w backend` on an empty volume creates the tables and the demo office.
- [x] Running the seed twice leaves exactly one demo plan with five zones, with the same ids.
- [x] The seed round-trip test passes: the stored plan equals `demoPlan`.
- [x] `GET /api/health` returns `200` with `database: up` while Postgres runs, and `503` when it is stopped.
- [x] `npm ci` without a `.env` (as in CI) generates the Prisma client, and typecheck and build pass.
- [x] Both CI jobs are green, and the backend job runs its e2e tests against a Postgres service.

## Decisions

1. **Prisma 7.10.1, pinned.** Prisma 8 is still a release candidate. *(Decided 2026-10-29.)*
2. **The seed imports `frontend/src/data/demoPlan.ts`.** One source until phase 4 moves the data into the backend. *(Decided 2026-10-29.)*
3. **Schema additions to the roadmap model:** `position`, `hitPadding`, `label`, `viewBox Float[]`, the `Lang` enum, and `ZoneType` mapped to the frontend's strings.
4. **Fixed UUIDs in the seed.**
5. **A separate `lzc_test` database for e2e tests.**

## Notes for phase 4

These come from the frontend using zone ids for more than lookups. When ids become UUIDs:

- **Marker strokes are seeded by zone id**, so they will look different, though still stable between renders. Seeding by `type`, or by the old slug, would keep today's strokes.
- **The hint is tied to the demo office.** Its zone is found by id (`HINT_ZONE_ID = "reception"`), and its "tap a zone →" arrow is static artwork aimed at where reception sits in the demo. In a plan without that zone, the hint silently never plays and the arrow points at whatever is there. Looking the zone up by `type` is not enough, because a plan may have no reception at all. Proposed: the hint targets the first zone in legend order (`position` 0), which exists in any plan with zones, and the arrow is computed from that zone's center, like labels and areas. The demo office does not change, because reception is first in its legend.

## Out of scope

- Endpoints that read or write plans, Swagger, generated frontend types (phases 4–5).
- Validating `shape` and `label` at the API boundary (phase 5).
- Running migrations in a Docker image (phase 8).
