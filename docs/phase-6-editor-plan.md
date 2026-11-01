# Phase 6 — Editor: plan

Part of the [roadmap](phase-0-roadmap.md). The result will be recorded in `phase-6-editor.md`.

## Goal

Plans and their zones can be edited in the browser. A list page creates, opens and deletes plans. An editor page moves and resizes zones, adds and deletes them, and edits a zone's type, color and texts and a plan's name, size and background. Every change is saved to the API as soon as it is made: the screen updates at once, a failed save is rolled back, and a `409` reloads the plan with a message.

The showcase page with the demo office stays as it is.

## Where we are

- The frontend is one page, the showcase: `SpaceMapper` renders the plan from `GET /api/plans/:id` (`usePlan`), with selection, the hint, the mobile sheet and the recommendation panel. There is no routing.
- The API has every endpoint the editor needs, with `version` and `409` on plans and zones ([phase-5-crud.md](phase-5-crud.md)). The frontend has the generated types for the request bodies, but no function that writes.
- `toFloorPlan()` drops `version` and turns `null` into missing fields; the TanStack Query cache holds the mapped `FloorPlan`.
- Frontend tests are unit tests in Node: geometry, markers, the API mapping. Nothing renders components.
- Every text of the interface is in `translations.ts` in English and Russian. `LanguageProvider` has `setLang`, but the page has no language switch.

## Decisions taken before the plan

*(Decided 2026-11-01.)*

1. **The editor is its own page.** `/` stays the showcase, `/plans` lists the plans, `/plans/:id/edit` edits one. The showcase keeps its polish, and the editor gets a layout built for editing.
2. **A properties panel edits more than geometry.** A selected zone's type, color and texts in both languages; with no zone selected, the plan's name, size, scale and background. A new zone gets draft texts ("New zone" / "Новая зона"), which the panel then replaces, so nothing needs Swagger.
3. **Polygons move and their vertices drag.** Rects and circles move and resize. A new polygon starts as a ready-made L shape whose vertices are then dragged; adding or removing vertices and drawing a polygon point by point are left out.
4. **No language switch yet.** Every new text of the interface (header, plans page, editor, messages) goes into `translations.ts` in English and Russian, like the existing ones, but the page still has no button to switch. *(Decided after the first draft.)*
5. **Every change saves at once.** Releasing a dragged zone or finishing a field sends one request. The screen shows the change before the answer; an error rolls it back, and a `409` reloads the plan and says why. This is the roadmap's plan, and phase 7 builds on it.

## Pages

```
/                    the showcase, as now (PLAN_ID or VITE_PLAN_ID)
/plans               list: open, create, delete
/plans/:id/edit      the editor
```

- **Routing: React Router** (`react-router` 8.5, the current major since June 2026; peer React ≥ 19.2.7, the app has 19.3). Its library mode, with a route per page. Step 2 checks the API of version 8 against the docs; the fallback is 7.18, the last 7.x.
- **A small header on every page**: links to the showcase and the plans. Its texts, like every new text, are translated (decision 4). The zone texts are edited in both languages at once.
- **Unknown paths** show a short "not found" with a link to `/`. Vite's dev server already serves `index.html` for every path; nginx gets the same rule in phase 8.

### Plans page

A list from `GET /api/plans`: name, number of zones, last change, with "Edit" and "Delete". Delete asks for confirmation, because nothing can undo it. "New plan" asks for a name and creates a plan with an 800 × 600 sheet at 32 px per meter and a blank background, then opens the editor.

### Editor page

```
┌ header ─────────────────────────────────────────────────────┐
│ ← Plans   Plan name      [+ Rect] [+ Circle] [+ Polygon] [🗑] │
├──────────────────────────────────────────┬──────────────────┤
│                                          │ properties:      │
│   the plan on its paper sheet            │ zone: type,      │
│   zones with handles when selected       │ color, texts     │
│                                          │ EN | RU          │
│                                          │ — or the plan:   │
│                                          │ name, size,      │
│                                          │ scale, background│
└──────────────────────────────────────────┴──────────────────┘
```

- **The canvas** draws the plan in its `viewBox`: the background artwork faintly and without pointer events, then each zone as its shape in its color, with its name. A selected zone gets an outline and handles. The showcase's marker strokes and hint are not used here; the editor shows the outlines being edited.
- **Selecting:** a click on a zone selects it; a click on the empty sheet or `Escape` clears the selection, and the panel shows the plan.
- **Moving:** drag a zone. The shape stays on the sheet (inside the `viewBox`).
- **Resizing:**
  - a rect has eight handles, its corners and edge middles;
  - a circle has one handle on its edge;
  - a polygon has a handle on each vertex.
  
  Rects keep at least 10 × 10 units, circles a radius of at least 5, and handles stay on the sheet.
- **Coordinates are whole units.** Every moved or resized value is rounded, so saved shapes stay readable.
- **Keyboard:** zones are focusable as on the showcase. With a zone selected, the arrow keys move it by 1 unit (10 with `Shift`), and `Delete` deletes it after confirmation. Every key move is saved like a drag.
- **Adding:** "+ Rect", "+ Circle" and "+ Polygon" add a zone in the middle of the sheet. A new polygon is an L shape of six points: since vertices cannot be added, six are enough to drag it into a rectangle with a notch, a trapezoid or a slanted corner. The zone is type `custom`, takes the next color of a fixed palette and gets draft texts. It is selected, so the panel is ready for its texts.
- **Deleting** asks for confirmation.
- **The properties panel** saves a field when it loses focus (or on `Enter`), not on every keystroke. Empty texts are not sent: the field shows the API's rule instead.
- **Small screens:** under 768 px the editor shows a note that it needs a larger screen, with a link back. Pointer events cover mouse, pen and touch, so tablets work.

## Data layer

### The cache holds the API's answer

`["plan", id]` caches the `PlanResponse` as the API sends it, versions and `null`s included. The showcase reads it through `select: toFloorPlan`, so its components do not change. The editor reads it as is, because it needs the versions. Both pages share one cache entry, so a change saved in the editor shows on the showcase without a refetch.

`["plans"]` caches the list.

### Requests

`lib/api/` gets a small `request()` helper and one function per endpoint. The helper:

- sends and reads JSON;
- throws `ApiError` with the status and the API's `message` on an error answer.

The functions are `listPlans`, `createPlan`, `updatePlan`, `deletePlan`, `createZone`, `updateZone` and `deleteZone`. Their bodies and results are the generated types (`CreateZoneDto`, `UpdateZoneDto`, …), so they follow the contract like `toFloorPlan()` does.

### Mutations

| Change | On screen | On success | On error |
| --- | --- | --- | --- |
| update a zone or the plan | at once (optimistic) | the cache takes the answer, with the new version | refetch the plan (rollback); `409`: message "changed elsewhere, reloaded" |
| delete a zone | at once | — | refetch the plan |
| add a zone | after the answer | the zone goes into the cache and is selected | message |
| create or delete a plan | after the answer | the list is refetched; a new plan opens in the editor | message |

- **Changes to one zone are sent one at a time.** TanStack Query's mutation `scope` queues them per zone (and per plan), and each request takes the version from the cache when it is sent, so the version follows the previous answer. Without this, two quick drags would send the same version, and the second would get a `409` from its own first change.
- **Rollback is a refetch**, not a restored snapshot. With queued changes, a snapshot taken before one change would also undo the ones after it; the server's state is always right.

*(Changed in step 3.)* The cache holds only what the server confirmed, and the editor shows it with the pending changes on top (`useMutationState`), the "optimistic via the UI" pattern of TanStack Query. A failed change then leaves the screen by itself, and an answer never overwrites a change still queued behind it. The reload after an error stays, so a `409` shows what changed and the next queued change gets the current version.
- **Messages** appear in a small status area of the editor: "Saving…", "Saved", "Could not save, the change was undone", "This plan was changed elsewhere and has been reloaded". They are announced to screen readers (`role="status"`).

## Code layout

```
frontend/src/
├── App.tsx                   routes and the header
├── pages/
│   ├── ShowcasePage.tsx      today's App content
│   ├── PlansPage.tsx
│   ├── PlanEditorPage.tsx
│   └── NotFoundPage.tsx
├── components/
│   ├── Header/
│   └── PlanEditor/           canvas, handles, toolbar, properties panels, status
└── lib/
    ├── api/                  request(), the endpoint functions, query and mutation hooks
    └── editor/               pure functions: move, resize, vertex drag, clamping, rounding, new zones
```

The drawing helpers that `SpaceMapperPlan.tsx` keeps to itself (`renderShape` and the colors) move to a shared module, so the editor draws shapes the same way.

## Tests

- **Unit, in Node (`lib/editor/`):**
  - moving and clamping to the sheet;
  - each rect handle, including dragging past the opposite edge;
  - the circle handle and minimum sizes;
  - a polygon vertex;
  - rounding;
  - the placement, size and palette of new rects, circles and polygons.
- **Unit (`lib/api/`):** `request()` with success, an error body and a network error; each endpoint function's method, URL and body; the cache helpers that put a saved zone or plan into the cached `PlanResponse`.
- **Components, in jsdom with Testing Library** (new dev dependencies: `jsdom`, `@testing-library/react`, `@testing-library/user-event`). The API is mocked at `fetch`. They cover:
  - the plans page lists, creates and deletes;
  - the editor selects a zone with a click and the keyboard;
  - an arrow key sends one `PATCH` with the right version;
  - a field saves on blur;
  - a failed save rolls back;
  - a `409` reloads and shows the message;
  - two quick changes send two versions in order.
  
  Dragging is covered by the pure functions; jsdom has no layout for `getScreenCTM`.
- **The showcase is unchanged:** screenshots of `/` from `main` and from the branch, compared byte for byte as in phase 4. The header moves the page down, which changes the antialiasing of the tilted sheet, so the branch is shot with the header hidden; both are shot back to back, because text renders slightly differently from one browser session to the next. *(Found in step 2.)*
- **By hand, in the browser:**
  1. Create a plan and add zones.
  2. Drag, resize and edit them.
  3. Check the change on `/` with `VITE_PLAN_ID`.
  4. Stop the API mid-edit and check the rollback.
  5. Edit one zone in two tabs and check the `409`.

## Steps

Each step is a separate commit, and both apps build after every one.

1. **Plan.** This document. Tick the last acceptance box of phase 5 (both CI jobs were green on PR #7).
2. **Routing.** React Router, the header, the showcase moved to `/` as `ShowcasePage`, empty `/plans` and `/plans/:id/edit`, not found. Screenshots of `/` against `main`.
3. **API layer.** `request()`, the endpoint functions, the cache of the API answer with `select`, mutation hooks with scopes, optimistic updates and refetch on error; unit tests. Testing Library and jsdom come in here.
4. **Plans page.** List, create, delete, with component tests.
5. **Editor canvas.** Drawing, selection, moving, resizing and vertex dragging with the pointer and the keyboard, saving on release; the pure functions with unit tests.
6. **Toolbar and panels.** Add and delete zones, the zone and plan properties, the status messages, the small-screen note; component tests for saving, rollback and `409`.
7. **Docs.** `phase-6-editor.md`, the roadmap, the README (the pages and how to edit).

## Acceptance criteria

- [ ] `/plans` lists the plans; a plan can be created, opened in the editor and deleted.
- [ ] In the editor, zones of all three kinds can be selected, moved and resized (polygons by their vertices), with the pointer and, for moving, the keyboard; each change is saved and survives a reload.
- [ ] Zones can be added (rect, circle, polygon) and deleted; a zone's type, color and texts in both languages, and the plan's name, size, scale and background, can be edited.
- [ ] A failed save is rolled back with a message; a change made meanwhile in another tab leads to `409`, a reload and a message.
- [ ] `/` looks and works as after phase 5: screenshots are byte-identical with the header hidden, except shots taken mid-animation or mid-hover.
- [ ] Both CI jobs are green.

## Out of scope

- Adding or removing polygon vertices, drawing a polygon point by point (decision 3).
- A language switch on the page (decision 4).
- Undo and redo, copy and paste, selecting several zones.
- Editing `zIndex`, `hitPadding` and the label offset, and reordering the legend.
- A grid, snapping to other zones, zooming and panning.
- Editing on phones (under 768 px).
- Live updates from other viewers (phase 7) and auth (phase 10).
