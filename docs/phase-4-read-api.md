# Phase 4 — Read API

Part of the [roadmap](phase-0-roadmap.md). The plan and its decisions are in [phase-4-read-api-plan.md](phase-4-read-api-plan.md).

The page now loads the floor plan from the API. The backend answers `GET /api/plans/:id` and serves Swagger UI, and the frontend's types for the response are generated from the API's OpenAPI document, so an API change that the frontend does not follow breaks the frontend build. A plan says what is drawn behind its zones: the demo office's artwork or a blank sheet.

The demo office looks as before, except for the marker strokes. The page has new loading and error states.

## API

```
GET /api/plans/:id     the plan with its zones and both languages
GET /api/docs          Swagger UI
GET /api/docs-json     the OpenAPI document
```

`GET /api/plans/:id` answers `400` when the id is not a UUID (`ParseUUIDPipe`, before the database is asked) and `404` when no plan has it. The response follows the frontend model ([an example in the plan](phase-4-read-api-plan.md#api)):

- zones come in legend order (`position`), which is not sent itself;
- every field is present, with `null` where the frontend model leaves a field out (`hitPadding`, `label`, `background`);
- zone types are the frontend's strings (`meeting-room`); the Prisma client calls them `MEETING_ROOM`, and `ZONE_TYPE_NAMES` maps them;
- `content` has one entry per language. A zone missing a language is an error, not a gap, because the frontend needs both;
- `version` is sent now, so the response keeps its shape when phase 5 uses it.

The module is `backend/src/plans/`: `PlansController`, `PlansService` (one Prisma query with zones and content), the response classes in `plan.response.ts` and `toPlanResponse()` in `plan.mapper.ts`.

## Schema change

`FloorPlan.background String?`, migration `add_plan_background`. The seed sets `"demo-office"` on the demo plan. The database does not restrict the values, because uploaded images (option A of the [background decision](phase-4-read-api-plan.md#decisions-taken-before-the-plan)) will use the same field; the API will validate writes in phase 5.

## Contract: OpenAPI → frontend types

```
backend/src/plans/plan.response.ts      (Swagger decorators)
  └─ npm run api:spec  → backend/openapi.json                    committed
       └─ npm run api:types → frontend/src/lib/api/schema.d.ts   committed
                                └─ toFloorPlan() → FloorPlan     the frontend model
```

- **`api:spec`** builds the backend and runs `dist/write-openapi.js`, which creates the Nest app, builds the document and writes it. No server is started and no database is needed, because `PrismaService` connects on the first query. It runs from the build because Nest needs decorator metadata, which `tsc` emits and `tsx` does not.
- **`api:types`** runs `openapi-typescript` with `--array-length`, so a fixed `minItems`/`maxItems` becomes a tuple: `viewBox` is `[number, number, number, number]`, a polygon point `[number, number]`.
- **`shape` is a discriminated union.** The three shape classes are `oneOf` with `kind` as the discriminator. The generated type is `RectShape | CircleShape | PolygonShape` with `kind: "rect" | "circle" | "polygon"`, and it fits the frontend's `Shape` without a cast.
- **The frontend keeps its own model.** `toFloorPlan()` names every field on both sides, drops `version` and turns `null` into a missing field. Removing `pxPerMeter` from the generated types was checked to fail the frontend typecheck in `toFloorPlan()`.
- **CI fails on stale files.** The backend job regenerates `openapi.json` after the build, and the frontend job regenerates `schema.d.ts` after install; each fails on `git diff --exit-code`. Removing `nullable` from `hitPadding` was checked to change both files. A change that breaks compilation fails `api:spec` itself.

**TypeScript versions.** `openapi-typescript` 7.13 declares `typescript ^5.x` as a peer dependency. It is a dev dependency of the backend, and a root `overrides` entry lets it use the backend's TypeScript 6, with which it works. TypeScript 7 has no JavaScript API yet, so the generator cannot run on the frontend's compiler.

## Frontend

- **Data layer** (`src/lib/api/`). `fetchPlan()` calls `/api/plans/:id` and throws an `ApiError` with the status on an error answer; `usePlan()` wraps it in TanStack Query 5. A `4xx` is not retried; a network error or a `5xx` is retried once, so the error state shows after about a second instead of the library's default of three retries.
- **Which plan.** `src/config.ts`: `VITE_PLAN_ID`, or the demo plan's fixed UUID. Routing between plans comes with the editor.
- **Proxy.** Vite forwards `/api` to `http://localhost:3000` in `dev` and `preview`, so the page calls its own origin and needs no CORS. Locally both servers have to run.
- **Loading and error states.** `SpaceMapper` loads the plan; until it arrives the section shows its heading and `PlanStatus`: a blank sheet in the plan's paper frame (`PAPER_SHEET_CLASS`) with "loading the plan…", or "The plan could not be loaded" and a "Try again" button that refetches. The map mounts only with the plan, so the hint's viewport trigger cannot fire before there is a map.
- **Background.** `PlanBackground` draws the walls, furniture and trees only when `background` is `"demo-office"`; any other value, or none, leaves a blank sheet. The entry note, which points at the demo office's door, belongs to the background.
- **Notes around the plan.** The tap hint, compass, palette and sheet title were drawn on the demo office's 800 × 600 sheet. Each group now keeps its distance to one edge of the plan's `viewBox` (`anchorTransform()` in `lib/plan/anchor.ts`): the hint to the middle of the top edge, the compass and palette to the top-right corner, the title and note to the bottom-left. On the demo office the transform is `translate(0 0)`.
- **Hint zone.** The marker hint plays on the first zone in legend order (`hintZoneId()`), which is reception in the demo office. `HINT_ZONE_ID = "reception"` is gone, and the comment that said the tap hint points at reception now says it points at the plan as a whole.
- **Marker strokes** are still seeded by the zone id, which is a UUID now, so the demo office's strokes have a slightly different hand-drawn shape.

## Demo data

`frontend/src/data/demoPlan.ts` moved to `backend/prisma/demo-plan-data.ts` (a git rename), because only the seed uses it now. It imports only the frontend's `FloorPlan` type. `frontend/src/data/demoPlan.test.ts` stays in the frontend, because it checks the data with the frontend's geometry, and imports it from the backend.

## Structure

```
backend/
├── openapi.json                generated, committed
├── prisma/
│   ├── demo-plan-data.ts       moved from the frontend
│   └── migrations/…_add_plan_background/
└── src/
    ├── openapi.ts              document + Swagger UI
    ├── write-openapi.ts        npm run api:spec
    └── plans/                  controller, service, mapper, response classes, zone type names
frontend/src/
├── config.ts                   PLAN_ID
├── lib/api/
│   ├── schema.d.ts             generated, committed
│   ├── plans.ts                fetchPlan, toFloorPlan, usePlan
│   └── queryClient.ts          retry rules
├── lib/plan/
│   ├── anchor.ts               notes anchored to the viewBox
│   └── hint.ts                 the hint zone
└── components/SpaceMapper/PlanStatus.tsx
```

## Tests and CI

| Suite | Covers |
| --- | --- |
| `backend/src/plans/plan.mapper.spec.ts` (5) | the response shape; `null` fields; zone order; all zone type names; a missing language is an error |
| `backend/test/plans.e2e-spec.ts` (3) | the seeded demo plan equals the demo data in the API's shape; `404`; `400` |
| `backend/test/openapi.e2e-spec.ts` (3) | Swagger UI is served; the endpoint, its operation id and `200`/`400`/`404`; the shape's discriminator mapping and `kind` values |
| `backend/test/seed.e2e-spec.ts` | also checks `background`, and uses `ZONE_TYPE_NAMES` instead of its own copy |
| `frontend/src/lib/api/plans.test.ts` (7) | `toFloorPlan` (all fields, `null` fields, order); `fetchPlan` (URL and abort signal, `ApiError` with the status); the retry rules |
| `frontend/src/lib/plan/anchor.test.ts` (4) | the demo sheet stays put; larger and smaller sheets; a viewBox not starting at `0 0` |

Totals: frontend 84, backend unit 22, backend e2e 14.

Mutation checks: the tests fail when zones are ordered by `zIndex` instead of `position`, and when `ParseUUIDPipe` is removed.

The workflow passed `actionlint`. In a `node:24` Linux container, with the database host unreachable, `api:spec` and `api:types` produced files identical to the ones generated on Windows, so the CI checks do not fail on line endings or paths.

## Visual check

Screenshots from headless Edge, in English and Russian, with and without reduced motion: the desktop map with the hint and with every zone selected, the mobile sheet and preview, and hover.

- **`main` against step 5:** only the marker strokes differ. The hint still plays on reception.
- **Step 5 against step 6:** all 18 screenshots are byte-identical, so moving the artwork behind `background` and anchoring the notes did not move a pixel.
- **Error state:** with the API stopped the page shows the error state; after starting the API, "Try again" loads the plan with its five zones.
- **Other plans, set by hand in `lzc`:** with `background` `null` the zones are drawn on a blank sheet with the hint, palette, compass and title; with a `1000 × 700` viewBox the compass and palette stay in the top-right corner and the title in the bottom-left.

## Findings

- **`npm install <package>` ignores `overrides` for a peer dependency.** `npm install openapi-typescript` failed with `ERESOLVE` even with the root override. Adding the package to `backend/package.json` by hand and running `npm install` applied the override.
- **A discriminator needs an explicit `mapping`.** Without it, `openapi-typescript` set `kind` to the schema names (`"RectShape"`), not to the values in the schemas' `enum`. The e2e test checks the mapping.
- **`tsx` cannot boot Nest.** It compiles with esbuild, which emits no decorator metadata, so dependency injection fails. The spec writer runs from the build instead.
- **The Prisma client does not use `@map` values.** Zone types read from the database are `MEETING_ROOM`, not `meeting-room`, so the API maps them back.
- **`npm audit` reports four moderate issues**, all one `minimatch` denial-of-service advisory in dev tools (`@nestjs/cli`, `@redocly/openapi-core` inside the generator). They do not reach the built app, and the suggested fixes would downgrade both tools to older majors, so they are left until upstream releases.

## Deviations from the plan

- **The hint zone changed in step 5, not step 6.** Zone ids became UUIDs in step 5, and without the change the hint would have stopped playing until step 6.
- **The palette is anchored too.** The plan named the hint, compass, title and note; the palette is drawn on every plan in the same 800 × 600 coordinates, so it is anchored to the top-right corner with the compass.
- **The loading state is rarely seen.** Against a local API the plan arrives within a frame or two; with the API down, the error state follows the single retry after about a second.

## Known gaps

- **The page shows one plan.** A list of plans and routing come with phases 5–6.
- **The demo data is imported across workspaces** by `frontend/src/data/demoPlan.test.ts` (from the backend) and by `backend/prisma/demo-plan-data.ts` (the frontend's `FloorPlan` type).
- **Notes on another plan can collide with its zones.** Anchoring keeps them at the edges, but a plan whose zones reach the corners would overlap them. Nothing checks this until plans other than the demo exist (phase 5).
- **`background` accepts any string** until the API validates writes in phase 5.
- **No caching headers.** The frontend caches in memory through TanStack Query only.
