# Phase 5 — CRUD

Part of the [roadmap](phase-0-roadmap.md). The plan and its decisions are in [phase-5-crud-plan.md](phase-5-crud-plan.md).

The API can now create, update and delete plans and zones. Every request body is validated, an unknown field is rejected, and an update based on an outdated version gets `409 Conflict`. The endpoints, their bodies and their errors are in the OpenAPI document, so the frontend's generated types now include the request bodies the editor will send in phase 6.

The page does not change: the frontend only regenerated its types.

## API

```
GET    /api/plans                 list plans, oldest first              200
GET    /api/plans/:id             plan with zones and content           200   (phase 4)
POST   /api/plans                 create a plan                         201
PATCH  /api/plans/:id             update a plan (version, 409)          200
DELETE /api/plans/:id             delete a plan, zones cascade          204
POST   /api/plans/:id/zones       add a zone                            201
PATCH  /api/zones/:id             update a zone (version, 409)          200
DELETE /api/zones/:id             delete a zone                         204
```

Every `:id` goes through `ParseUUIDPipe` (`400`); an unknown plan or zone is `404`.

- **`GET /api/plans`** returns `{ id, name, background, zoneCount, updatedAt }` per plan.
- **`POST /api/plans`** takes `{ name, viewBox, pxPerMeter, background? }` and returns the plan at version 1 with no zones.
- **`POST /api/plans/:id/zones`** takes `{ type, shape, color, zIndex?, hitPadding?, label?, content: { en, ru } }`. The zone goes last in the legend; without `zIndex` it is drawn above the plan's other zones.
- **`PATCH`** takes `version` and any of the other fields. `shape` and `label` are replaced whole; `content` may hold one language, and the other stays. `null` is accepted only where it means something: `background` (a blank sheet), `hitPadding` and `label` (the frontend defaults). A body with nothing besides `version`, or only `content: {}`, is `400`.
- **`DELETE`** of a zone leaves the others in their legend order; gaps in `position` do not matter.

Plans got `version` (migration `add_plan_version`, default 1), and `PlanResponse` sends it. The frontend's `toFloorPlan()` leaves it out, as it does for zones.

### Versions and `409`

`versionedUpdate()` in `backend/src/prisma/versioned-update.ts` serves both plans and zones. The update has the version in its `where`, so the check and the write are one statement. When nothing matches, Prisma throws `P2025`, and a second query decides: the row exists → `409`, it does not → `404`. Of two concurrent `PATCH` requests on the same version, one gets `200` and the other `409`.

A zone `PATCH` changes the zone and the languages sent in one transaction: after a `409` nothing has changed, and after two concurrent requests the stored color and text come from the same one.

The `409` body is Nest's usual error with the message "… has been changed since this version; reload it". The client refetches.

## Validation

A global `ValidationPipe` in `configureApp()` (`backend/src/validation.ts`): `whitelist` and `forbidNonWhitelisted`, so an unknown field is `400`, and `transform`. The rules follow the [table in the plan](phase-5-crud-plan.md#validation). A `400` names every invalid field:

```json
{
  "message": [
    "property extra should not exist",
    "name should not be empty",
    "viewBox must be [minX, minY, width, height] with finite numbers and a width and height above 0"
  ],
  "error": "Bad Request",
  "statusCode": 400
}
```

- **Shapes pick their class by `kind`.** `ShapeProperty()` in `backend/src/zones/shape.ts` documents the field as the `oneOf` from phase 4 and tells `class-transformer` which class to build. Any other `kind` becomes `UnknownShape`, whose only rule is `kind`, so the error says "shape.kind must be one of …" instead of rejecting `kind` as an unknown property. The plan's fallback, a custom validator, was not needed.
- **The same classes serve responses and requests.** `RectShape`, `CircleShape`, `PolygonShape`, `ZoneLabel` and `ZoneContent` carry both `@ApiProperty` and the validators. `ZoneContentResponse` became `ZoneContent`, because it now validates input too.
- **The request DTOs** are `CreatePlanDto`, `UpdatePlanDto` (`plans/plan.dto.ts`), `CreateZoneDto`, `UpdateZoneDto` and `ZoneContentPatch` (`zones/zone.dto.ts`). The update DTOs use `PartialType(…, { skipNullProperties: false })`: the default would accept `null` for every field and let it reach `NOT NULL` columns as a `500`.
- **`background`** accepts `"demo-office"` or `null`. It is widened when plans get uploaded images.
- **Shapes are not checked against the `viewBox`**, as planned.

## Backend layout

```
backend/src/
├── app.ts                          + global ValidationPipe
├── validation.ts                   pipe options, assertChanges(), shared validators
├── prisma/versioned-update.ts      the version check: 409 or 404
├── plans/
│   ├── plan.dto.ts                 CreatePlanDto, UpdatePlanDto
│   ├── plan-summary.response.ts    GET /api/plans
│   ├── plan.response.ts            PlanResponse
│   └── plans.controller.ts / plans.service.ts
└── zones/
    ├── shape.ts                    the shape classes and ShapeProperty()
    ├── zone.response.ts            ZoneResponse, ZoneLabel, ZoneContent
    ├── zone.dto.ts                 CreateZoneDto, UpdateZoneDto
    ├── zone.mapper.ts              toZoneResponse(), used by both modules
    ├── zone-type.ts                moved from plans/; both directions of the type names
    └── zones.module.ts / zones.controller.ts / zones.service.ts
```

## Tests and CI

| Suite | Covers |
| --- | --- |
| `backend/src/plans/plan.dto.spec.ts` (9) | create and update bodies: required fields, the viewBox, backgrounds, `null` only for `background`, unknown fields, the version |
| `backend/src/zones/zone.dto.spec.ts` (12) | each shape kind and its class; unknown or missing `kind`; shapes without an area, bad points, `Infinity`, numbers as strings; another kind's fields; type, color, `hitPadding`, `label`; both languages; `null` only for `hitPadding` and `label` |
| `backend/test/plans-crud.e2e-spec.ts` (12) | every plan endpoint read back through `GET`; `400`, `404`, `409`; two concurrent `PATCH`es; a `PATCH` that changes nothing; cascade to zones and content |
| `backend/test/zones.e2e-spec.ts` (14) | every zone endpoint read back through the plan; defaults; stored positions and `zIndex`; one language changed; `null` back to defaults; `409` with content untouched; two concurrent `PATCH`es; legend order after a delete |
| `backend/test/openapi.e2e-spec.ts` (+2) | the operation ids `plans_*` and `zones_*`, their responses including `409`, the request bodies |

Totals: backend unit 43, backend e2e 42, frontend 84.

Mutation checks, each failing at least one test:

- the version left out of the update's `where`, for plans and for zones;
- `forbidNonWhitelisted` turned off;
- `PartialType` without `skipNullProperties: false`;
- `IsDefined` taken off the shape;
- `assertChanges()` left out, or counting `content: {}` as a change;
- every new zone at `position` 0. At first this passed: the order fell back to the creation time. The tests now check the stored positions.

**Live check.** Against the dev database with `node dist/main.js`, through the same requests Swagger UI sends:

1. `GET /api/plans` listed the demo office.
2. A plan was created, given a zone and renamed.
3. The zone's color and Russian text were changed.
4. A stale `PATCH` got `409` and a bad body `400`.
5. Deleting the plan answered `204`, then `404`; the demo office stayed.

## Findings

- **`ValidateNested` passes over a missing value.** A zone without `content.ru` was accepted until the nested fields got `@IsDefined()`. A unit test found it.
- **`openapi-typescript` mis-nests a tuple with `minItems`.** `minItems: 3` on a polygon's points, with `--array-length`, became a tuple of arrays of points. The schema leaves `minItems` out; the validator checks the three points and the description says so.
- **OpenAPI 3.0 has a boolean `exclusiveMinimum`.** Nest writes 3.0 documents, so "above 0" is `minimum: 0, exclusiveMinimum: true`.
- **Prisma needs `Prisma.DbNull` to clear a JSON column.** `label: null` is written as `DbNull`.
- **Cyrillic in `curl` arguments from Git Bash on Windows arrives garbled.** It looked like an encoding bug in the API during the live check. Sent from a UTF-8 file (`--data-binary @body.json`) it is stored and returned correctly, as the e2e tests with Russian text show.

## Deviations from the plan

- **The shape classes live in `zones/`, not `plans/`**, together with the zone response, mapper and type names, which moved there too: shapes belong to zones, and the plan module only imports them.
- **The DTOs came with the validation step (3)**, so their unit tests could run before the endpoints existed.
- **Zones that tie on `position` are ordered by creation time.** Two concurrent `POST`s can compute the same position; the plan did not cover this.
- **`content: {}` counts as no change**, like a body with only `version`.

## Known gaps

- **The demo plan can be changed or deleted by anyone who reaches the API.** `npm run db:seed` restores it. What a deployed API does about it is the roadmap's [open question 1](phase-0-roadmap.md#open-questions), for phase 9.
- **Concurrent `POST`s to one plan can share a `position`.** The legend order stays defined (creation time), and nothing reorders zones yet.
- **A zone's `version` does not change when its plan changes**, and the reverse. Each is versioned on its own.
- **`DELETE` takes no version**, as in the roadmap: deleting a zone someone else just changed succeeds.
- **No pagination** for `GET /api/plans`.
