# Phase 5 — CRUD: plan

Part of the [roadmap](phase-0-roadmap.md). The result is recorded in [phase-5-crud.md](phase-5-crud.md).

## Goal

The API can create, update and delete plans and zones. Every write is validated at the boundary, and an update based on an outdated version is refused with `409 Conflict`. The endpoints, their request bodies and their errors are described in the OpenAPI document, so phase 6 gets typed functions for the editor from the same contract as the read path.

The page does not change. The editor, a list of plans and routing come in phase 6.

## Where we are

- The API has `GET /api/plans/:id`, `/api/health` and Swagger (phase 4). No endpoint writes, and no `ValidationPipe` is set up.
- `shape` and `label` are JSON columns that only the seed writes; nothing checks them ([phase-3-database.md](phase-3-database.md)).
- `Zone` has `version`, which the API sends but nothing increments. `FloorPlan` has no version.
- `background` accepts any string ([phase-4-read-api.md](phase-4-read-api.md#known-gaps)).
- The response classes in `backend/src/plans/plan.response.ts` describe the three shapes with `kind` as the discriminator. The phase 4 plan said phase 5 would reuse them for input.

## Decisions taken before the plan

*(Decided 2026-11-01.)*

1. **The demo plan is not protected.** Until auth (phase 10), anyone who can reach the API can change or delete the demo office. Then the page shows its error state until `npm run db:seed` runs again. That is fine while the API runs only locally. What a deployed demo needs goes into the roadmap's open questions and is settled in phase 9.
2. **New zones go to the end of the legend.** `POST` sets `position` after the last zone, and there is no endpoint to reorder. The phase 6 editor drags, resizes, adds and deletes zones, but does not reorder the legend.
3. **Plans get a version too.** `FloorPlan.version` works like `Zone.version`: `PATCH` sends the version it was based on and gets `409` if it is stale. One rule for every update, and phase 7 can rely on it when changes arrive live.
4. **The frontend only regenerates its types.** No UI and no write functions yet; they come with the editor in phase 6.

## API

```
GET    /api/plans                 list plans
GET    /api/plans/:id             plan with zones and content          (phase 4)
POST   /api/plans                 create a plan                        201
PATCH  /api/plans/:id             update a plan (version, 409)         200
DELETE /api/plans/:id             delete a plan, zones cascade         204
POST   /api/plans/:id/zones       add a zone                           201
PATCH  /api/zones/:id             update a zone (version, 409)         200
DELETE /api/zones/:id             delete a zone                        204
```

All `:id` parameters go through `ParseUUIDPipe` (`400`). An unknown plan or zone is `404`.

### Plans

- **`GET /api/plans`** returns a summary per plan, oldest first, so the demo office comes first: `{ id, name, background, zoneCount, updatedAt }`. No pagination.
- **`POST /api/plans`** takes `{ name, viewBox, pxPerMeter, background? }` and returns the new plan as `PlanResponse`, with no zones and `version: 1`.
- **`PATCH /api/plans/:id`** takes `{ version, name?, viewBox?, pxPerMeter?, background? }` and returns the updated `PlanResponse` with its zones.
- **`DELETE /api/plans/:id`** deletes the plan; its zones and their content go with it (`onDelete: Cascade`).

`PlanResponse` gets `version`. The frontend's `toFloorPlan()` names every field it takes, so it ignores the new field without a change.

### Zones

- **`POST /api/plans/:id/zones`** takes `{ type, shape, color, zIndex?, hitPadding?, label?, content: { en, ru } }` and returns `ZoneResponse`. Both languages are required, because the frontend shows every zone in both. `zIndex` defaults to one above the plan's highest; `position` is always last (decision 2).
- **`PATCH /api/zones/:id`** takes `{ version }` and any of `type`, `shape`, `color`, `zIndex`, `hitPadding`, `label`, `content`. `shape` and `label` are replaced whole, as the roadmap decided. `hitPadding: null` and `label: null` go back to the frontend defaults. `content` may hold one language or both; each one sent is replaced whole. Returns the updated `ZoneResponse`.
- **`DELETE /api/zones/:id`** deletes the zone. It takes no version, as in the roadmap. The legend order of the remaining zones stays the same; gaps in `position` do not matter.

### Versions and `409`

The check and the write are one statement: `update … where id = :id and version = :version`, which also increments `version`. When no row matches, a second query tells the two cases apart: the row exists → `409`, it does not → `404`. Two concurrent `PATCH` requests with the same version therefore get one `200` and one `409`, never two `200`s. A zone `PATCH` that also changes content runs in one transaction.

A `PATCH` with nothing but `version` is `400`, so a version does not grow without a change.

The `409` body is Nest's usual error (`statusCode`, `message`, `error`). The client refetches to get the current state; phase 6 decides what the editor shows then.

## Validation

A global `ValidationPipe` in `configureApp()`, so the e2e tests and the running app validate the same way:

- `whitelist` + `forbidNonWhitelisted`: an unknown field is `400`, not silently dropped;
- `transform`: the handlers receive class instances.

| Field | Rule |
| --- | --- |
| `name` | non-empty string, at most 200 characters |
| `viewBox` | 4 finite numbers, width and height above 0 |
| `pxPerMeter` | above 0 |
| `background` | `"demo-office"` or `null`; widened when plans get uploaded images |
| `type` | one of the six zone type names |
| `shape` | by `kind`: a rect has width and height above 0 and `rx` ≥ 0; a circle has `r` above 0; a polygon has at least 3 points of 2 finite numbers each |
| `color` | `#rrggbb` |
| `zIndex` | integer |
| `hitPadding` | integer ≥ 0, or `null` |
| `label` | `dx`, `dy` numbers; `fontSize` above 0; `areaDy` a number; or `null` |
| `content.<lang>` | `name`, `tagline`, `recommendation`, `rationale`: non-empty strings; `name` and `tagline` at most 200 characters |
| `version` | integer ≥ 1 |

**Shapes are not checked against the `viewBox`.** A plan's `viewBox` can change after its zones exist, and a zone partly outside the sheet is still valid data. The editor keeps zones on the sheet in phase 6.

**The shape classes serve both directions.** `RectShape`, `CircleShape` and `PolygonShape` move from `plan.response.ts` to `shape.ts` and get `class-validator` decorators next to their `@ApiProperty` ones. A shape field picks its class by `kind` through `class-transformer`'s discriminator (`@Type(() => …, { discriminator, keepDiscriminatorProperty: true })`), and the OpenAPI schema stays the `oneOf` with the mapping from phase 4. If the discriminator turns out not to work with `ValidationPipe`, the fallback is a custom validator that checks the plain object by `kind`. Either way the unit tests below decide.

Request DTOs are separate classes from the responses: `CreatePlanDto`, `UpdatePlanDto`, `CreateZoneDto`, `UpdateZoneDto`. The update DTOs are built with `PartialType` from `@nestjs/swagger`, so the documentation follows.

## Schema change

`FloorPlan.version Int @default(1)`, migration `add_plan_version`. The seed is unchanged: it recreates the demo plan, which then starts at version 1.

## Backend layout

```
backend/src/
├── app.ts                        + global ValidationPipe
├── plans/
│   ├── shape.ts                  the three shape classes, used by the responses and the DTOs
│   ├── plan.dto.ts               CreatePlanDto, UpdatePlanDto
│   ├── plan-summary.response.ts  GET /api/plans
│   └── plans.controller.ts / plans.service.ts   + list, create, update, delete
└── zones/
    ├── zones.module.ts
    ├── zones.controller.ts       POST /plans/:id/zones, PATCH and DELETE /zones/:id
    ├── zones.service.ts
    └── zone.dto.ts               CreateZoneDto, UpdateZoneDto
```

The zone mapper (`toZoneResponse`) is split out of `toPlanResponse`, so both modules return zones in the same shape. Zones get their own module, as in the roadmap's target layout.

## Contract

Each step that changes the API regenerates `backend/openapi.json` and `frontend/src/lib/api/schema.d.ts` in the same commit, so the CI checks from phase 4 stay green along the way. Every endpoint documents its errors (`400`, `404`, `409`) and gets an `operationId` such as `plans_create` or `zones_update`, which become the names of the functions in phase 6.

## Tests

- **Unit (`backend/src/plans/*.spec.ts`, `backend/src/zones/*.spec.ts`):** the DTOs through `plainToInstance` + `validate`: each shape kind accepted; an unknown `kind`, a two-point polygon, a negative radius rejected; the extra fields of another kind rejected; `background`, `color`, `content` with one language on create.
- **E2E (`backend/test/plans-crud.e2e-spec.ts`, `zones.e2e-spec.ts`):** each file creates its own plans and deletes them afterwards, and leaves the demo plan to `plans.e2e-spec.ts`. They cover:
  - every endpoint's success path, read back through `GET /api/plans/:id`;
  - `400` for a bad body, an unknown field, a non-UUID id;
  - `404` for an unknown plan or zone, including `POST` to an unknown plan's zones;
  - `409` for a stale version, and one `200` plus one `409` for two concurrent `PATCH` requests;
  - a created zone's `position` comes last and its `zIndex` is one above the highest;
  - deleting a plan deletes its zones.
- **OpenAPI e2e:** every new path and `operationId`, and the `409` responses.
- **Mutation checks:** the tests fail when the version condition is removed from the update, and when `forbidNonWhitelisted` is turned off.

## Steps

Each step is a separate commit, and both apps build after every one.

1. **Plan.** This document. Tick the last acceptance box of phase 4 (both CI jobs were green on PR #6). In the roadmap, add the open question about the deployed demo plan (decision 1) and `version` on `FloorPlan` in the data model.
2. **Plan version.** Migration `add_plan_version`; `version` in `PlanResponse` and the mapper; regenerate the contract.
3. **Validation.** Global `ValidationPipe`; `shape.ts` with validators and the discriminator; the zone mapper split out; DTO unit tests. No new endpoints yet. *(Done; the shape classes, zone response, mapper and type names went to `zones/`, and the discriminator worked without the fallback.)*
4. **Plan endpoints.** `GET /api/plans`, `POST`, `PATCH`, `DELETE` with e2e tests; regenerate the contract.
5. **Zone endpoints.** `ZonesModule` with `POST`, `PATCH`, `DELETE` and e2e tests, including the concurrent `PATCH`; regenerate the contract. *(Done; zones that tie on `position` are ordered by creation time.)*
6. **Docs.** `phase-5-crud.md`, the roadmap (built endpoints), the README (writing through Swagger UI).

## Acceptance criteria

- [x] In Swagger UI a plan can be created, given zones, renamed, have a zone changed and be deleted, and each change shows in `GET /api/plans/:id`.
- [x] Invalid bodies are `400` with the field named; unknown fields are `400`; unknown ids are `404`.
- [x] A `PATCH` of a plan or a zone with a stale version is `409`, and two concurrent `PATCH` requests on one version give one `200` and one `409`.
- [x] Every new endpoint is in `openapi.json` with its errors, and the frontend's generated types include the request bodies.
- [x] The page looks and works as after phase 4.
- [x] Both CI jobs are green.

## Out of scope

- Any frontend UI: the editor, a list of plans, routing (phase 6).
- Reordering the legend (decision 2).
- Protecting the demo plan (decision 1; open question for phase 9).
- Checking shapes against the `viewBox`, or zones against each other.
- Broadcasting changes (phase 7), auth (phase 10), uploaded backgrounds.
- Pagination, bulk operations, undo.
