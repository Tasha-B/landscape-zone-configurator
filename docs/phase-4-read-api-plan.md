# Phase 4 — Read API: plan

Part of the [roadmap](phase-0-roadmap.md). The result will be recorded in `phase-4-read-api.md`.

## Goal

The frontend loads the floor plan from the API instead of importing it. The API gets `GET /api/plans/:id` and Swagger, and the frontend gets TypeScript types generated from the API's OpenAPI document, so a change in the API that the frontend does not follow breaks the frontend build.

The page looks and behaves as before, with two exceptions: marker strokes look slightly different (see [Zone ids are UUIDs](#zone-ids-are-uuids)), and the page now has loading and error states. Plans other than the demo office are not created yet; that is phase 5.

## Where we are

- The database holds the demo office: one `FloorPlan` and five zones with fixed UUIDs, seeded from `frontend/src/data/demoPlan.ts`.
- `SpaceMapper.tsx` renders `const plan = demoPlan`, with zone ids `reception`, `meeting-room` and so on.
- `PlanBackground.tsx` draws the demo office's walls, doors, furniture and trees as static SVG in the coordinates of its `viewBox` (`0 0 800 600`). `PlanAnnotations` adds handwritten notes in the same coordinates: the entry note, the "tap a zone" hint, the compass, the sheet title.
- The hint marker plays on `HINT_ZONE_ID = "reception"`.
- The API has `/api/health` only. The frontend has no data-fetching library and no `/api` proxy.

## Decisions taken before the plan

From the roadmap's [open question 1](phase-0-roadmap.md#open-questions) and the [notes for phase 4](phase-3-database-plan.md#notes-for-phase-4). *(Decided 2026-10-30.)*

1. **Background: a blank sheet now, an uploaded image later.** Walls, doors, furniture and trees are artwork of the demo office, so a second plan would show its zones over the demo office's walls. The options were:

   | Option | What it takes | Trade-off |
   | --- | --- | --- |
   | A. Background image per plan | Upload an SVG or PNG floor plan, drawn under the zones and scaled to the `viewBox` | Works with any existing drawing; cannot be edited in the app |
   | B. Walls as data | New models for walls, doors and furniture, drawn and edited like zones | Fully editable; a large addition to the model, the API and the editor |
   | C. Blank sheet | Zones on the paper texture only | No extra work; a plan without walls is hard to read |

   A plan gets a `background` field. `"demo-office"` draws today's artwork; `null` draws the zones on the paper texture only (C). When plans get their own drawings (A), the same field will point to the uploaded image. Walls as data (B) are not planned.
2. **Marker strokes keep the zone id as their seed.** With UUIDs the strokes of the demo office change shape. The new look is accepted: the old one came from hashing the slugs and was never tuned by hand, and a UUID stays the same through renames and edits.
3. **The hint plays on the first zone in legend order.** Every plan with zones has one, and in the demo office it is still reception. The "tap a zone" note and its arrow point at the plan as a whole, not at a zone, so they stay as they are and do not follow the hint zone.

## API

```
GET /api/plans/:id     the plan with its zones and both languages
GET /api/docs          Swagger UI
GET /api/docs-json     the OpenAPI document
```

`GET /api/plans/:id` answers `400` when `:id` is not a UUID (`ParseUUIDPipe`) and `404` when no plan has it. The response uses the frontend's names and structure:

```json
{
  "id": "00000000-0000-4000-8000-000000000001",
  "name": "Cairn Botanics office",
  "viewBox": [0, 0, 800, 600],
  "pxPerMeter": 32,
  "background": "demo-office",
  "zones": [
    {
      "id": "00000000-0000-4000-8000-000000000101",
      "type": "reception",
      "shape": { "kind": "rect", "x": 88, "y": 98, "width": 214, "height": 134, "rx": 4 },
      "color": "#C9962A",
      "zIndex": 1,
      "hitPadding": null,
      "label": { "dx": 31, "dy": -19 },
      "version": 1,
      "content": {
        "en": { "name": "Reception", "tagline": "First impression", "recommendation": "…", "rationale": "…" },
        "ru": { "name": "…", "tagline": "…", "recommendation": "…", "rationale": "…" }
      }
    },
    …
  ]
}
```

- **Zones come in legend order** (`position`), and `position` itself is not sent: array order is the legend order, as in the frontend model.
- **`null` instead of missing fields** (`hitPadding`, `label`, `background`). The OpenAPI document states every field, and the frontend maps `null` to its defaults.
- **`version` is sent now**, although only phase 5 uses it, so the response does not change shape then.
- **`shape` is documented as one of three schemas** (`rect`, `circle`, `polygon`) with `kind` as the discriminator. Phase 5 reuses these classes to validate input.

New backend module `plans/`: `PlansController`, `PlansService` (one Prisma query with zones ordered by `position` and their content), response DTO classes with Swagger decorators, and a mapper from Prisma rows to the response.

## Schema change

`FloorPlan.background String?` with a migration. The seed sets `"demo-office"` on the demo plan. Values are not restricted in the database, because option A will store image references in the same field; the API validates writes in phase 5.

## Contract: OpenAPI → frontend types

```
backend (Nest + Swagger decorators)
   └─ npm run api:spec  → backend/openapi.json       (committed)
        └─ npm run api:types → frontend/src/lib/api/schema.d.ts   (committed, openapi-typescript in the backend)
```

- **The spec is written without a running server.** A script builds the Nest app, creates the Swagger document and writes it to `backend/openapi.json`. No database is needed: `PrismaService` connects on the first query.
- **Both files are committed** and CI regenerates them and fails on a difference (`git diff --exit-code`): the spec in the backend job, the types in the frontend job. So the frontend's types cannot fall behind the API without CI noticing. No new CI jobs; the required check names stay.
- **The frontend keeps its own model** (`lib/plan/types.ts`). One function, `toFloorPlan(response)`, turns the generated response type into a `FloorPlan`: `null` → `undefined`, `viewBox` → a 4-tuple. It is type-checked against both sides, so a renamed or removed field breaks the frontend build. Deriving the model from the generated types directly would push `null` and `version` through every component.

**`openapi-typescript` and TypeScript versions.** Version 7.13 (the latest) declares `typescript ^5.x` as a peer dependency, and npm refuses to install it in either workspace (`ERESOLVE`: the backend has TypeScript 6, the frontend TypeScript 7). Checked on 2026-10-30, outside the repo:

| TypeScript | Generation |
| --- | --- |
| 6.0 | works: the compiler API it uses (`ts.factory`) is the same as in 5.x, only the peer range is out of date |
| 7.0 | fails with `ts.factory` undefined: the native compiler's npm package has no JS API yet |

So the generator is a dev dependency of the **backend**, and the root `package.json` lets it use the backend's TypeScript:

```json
"overrides": { "openapi-typescript": { "typescript": "^6.0.2" } }
```

The frontend only receives the generated `schema.d.ts` and does not depend on the generator. `npm ci` installs every workspace, so the frontend CI job can still run `api:types`. If the backend moves to TypeScript 7 before `openapi-typescript` supports it, the fallbacks are another generator (`@hey-api/openapi-ts`) or hand-written response types checked against `openapi.json` by a test.

## Demo data moves to the backend

`frontend/src/data/demoPlan.ts` becomes `backend/prisma/demo-plan-data.ts`, since after this phase only the seed uses it. The frontend's `demoPlan.test.ts` checks the demo data against frontend geometry (areas, label positions, marker strokes), so it stays in the frontend and imports the data from the backend: the reverse of today's import. If the frontend's TypeScript config makes this awkward, the test moves to the backend instead and imports the geometry.

## Frontend

- **TanStack Query** (`@tanstack/react-query` 5). A `QueryClientProvider` in `main.tsx`, and `usePlan(id)` = `useQuery({ queryKey: ["plan", id], queryFn })` in `lib/api/`. `fetchPlan()` calls `fetch("/api/plans/" + id)` and `toFloorPlan()`.
- **Which plan.** The page shows one plan until the editor brings routing (phase 6): `PLAN_ID`, from `VITE_PLAN_ID` or the demo plan's fixed UUID by default.
- **Vite proxy**: `/api` → `http://localhost:3000` in development, so the browser calls the same origin and no CORS is needed. In production (phase 8) nginx does the same.
- **Loading and error states.** While loading: the paper sheet with the plan's frame and no zones, so the layout does not jump. On error: a short message in both languages and a "Try again" button (`refetch`). Both are translated like the rest of the UI.
- **Background by field.** `background === "demo-office"` draws `PlanBackground` and the entry note, which points at the demo office's door. Any other value draws nothing behind the zones. The hint, compass, sheet title and note are drawn for every plan, placed from the edges of the plan's `viewBox`, so the demo office renders exactly as before.
- **Hint zone** = `plan.zones[0]`. `HINT_ZONE_ID` goes away, and the comment that says the hint points at reception is corrected.

### Zone ids are UUIDs

Selection, hover, legend and keyboard focus all key on `zone.id`, which only needs to be unique, so they keep working. The two places that used the slug as meaning are the hint (decision 3) and the marker seed (decision 2). Screenshots of the demo office before and after record the stroke change.

## Steps

Each step is a separate commit, and both apps build after every one.

1. **Plan.** This document. Tick the last acceptance box of phase 3 (both CI jobs were green on PR #5). In the roadmap, move open question 1 into this plan's decisions.
2. **Schema and data.** Add `background` and its migration; move the demo data into the backend; the seed sets `background`; `demoPlan.test.ts` follows the data.
3. **`GET /api/plans/:id`.** `PlansModule`, DTOs, mapper. E2E against the seeded `lzc_test`: the response, mapped back, equals the demo data; `404` for an unknown UUID; `400` for `abc`.
4. **Swagger and the contract.** Swagger UI at `/api/docs`; `api:spec` and `api:types` scripts; the committed `openapi.json` and `schema.d.ts`; CI steps that fail when either is stale. `openapi-typescript` goes into the backend with the root `overrides` entry described above.
5. **Frontend data layer.** TanStack Query, the proxy, `fetchPlan` and `toFloorPlan` with unit tests, loading and error states. The page renders the plan from the API.
6. **Background, annotations and hint.** The `background` switch, annotations placed from the `viewBox`, the hint on the first zone. Screenshots before and after.
7. **Docs.** `phase-4-read-api.md`, the roadmap (API and status), the README (both servers for local development, `api:*` scripts).

## Acceptance criteria

- [ ] With the database seeded and both dev servers running, the page shows the demo office loaded from `/api/plans/:id`; there is no `demoPlan` import left in the frontend's app code.
- [ ] The demo office looks as before, except for the marker strokes; selection, hover, legend, keyboard, the mobile sheet and the hint work.
- [ ] With the API stopped, the page shows the error state, and "Try again" loads the plan once the API is back.
- [ ] A plan with `background: null` shows its zones on a blank sheet, with the hint on its first zone (checked by changing the field in `lzc` by hand).
- [ ] `GET /api/plans/:id` answers `200`, `404` and `400` as above; Swagger UI lists the endpoint and the three shape schemas.
- [ ] Changing a response field in the backend without regenerating fails CI; regenerating and not updating the frontend fails the frontend typecheck.
- [ ] Both CI jobs are green.

## Out of scope

- Creating, editing and deleting plans and zones; validating `shape` and `label` (phase 5).
- A list of plans and routing between them (phases 5–6).
- Uploading background images (option A), whenever it is scheduled.
- Caching headers, ETags, pagination.
