# Phase 6 — Editor

Part of the [roadmap](phase-0-roadmap.md). The plan and its decisions are in [phase-6-editor-plan.md](phase-6-editor-plan.md).

Plans and their zones are edited in the browser. A list page creates, opens and deletes plans. The editor:

- moves and resizes zones;
- adds and removes polygon vertices;
- adds and deletes zones;
- edits a zone's type, color and texts and a plan's name, size, scale and background.

Every change is saved as soon as it is made. It shows on screen before the server answers, a failed save is undone, and a `409` reloads the plan with a message.

The showcase on `/` is unchanged: its screenshots are byte-identical to `main` (see [Checks](#checks)).

## Pages

```
/                    the showcase (PLAN_ID or VITE_PLAN_ID)
/plans               list: open, create, delete
/plans/:id/edit      the editor
anything else        "This page does not exist", with a link to /
```

- **Routing:** React Router 8.5 in declarative mode (`BrowserRouter`, `Routes`). Version 8 kept the 7.x API for this. There are no route loaders: the data comes from TanStack Query.
- **Header** on every page: links to the showcase and the plans.
- **Plans page:**
  - each row shows the plan's name (a link to the editor), the number of zones and the last change, with "Edit" and "Delete";
  - the showcase's plan is marked "on the showcase";
  - "Delete" asks in the row itself, with the focus on "Cancel";
  - a new plan needs only a name: it gets an 800 × 600 sheet at 32 units per meter, a blank background, and opens in the editor.
- **The editor's heading is the plan's name.** Under 768 px the editor shows a note that it needs a wider screen.

## The editor

```
┌───────────────────────────────────────────────┬─────────────────────┐
│ [+ Rectangle] [+ Circle] [+ Polygon] [Delete]  │ Zone: type, color,   │
│                              status line       │ texts               │
├───────────────────────────────────────────────┤ — or, with nothing   │
│ the plan on its sheet: outlines in each zone's │ selected, the plan:  │
│ color, names, handles on the selected zone     │ name, size, scale,   │
│                                                │ background          │
└───────────────────────────────────────────────┴─────────────────────┘
```

### On the canvas

- **Selecting.** A click on a zone selects it and puts the focus on it. A click on the empty sheet or `Esc` clears the selection.
- **Moving.** Drag a zone. A press that stays within 4 screen pixels is a click, not a move, so a shaky hand does not nudge a zone.
- **Resizing:**
  - a rect has eight handles;
  - a circle has one on its right edge;
  - a polygon has one per vertex, whose cursor is a double arrow pointing away from the polygon's center.

  Dragged past the opposite edge, a rect flips. Rects keep at least 10 × 10, circles a radius of 5.
- **Polygon vertices.** A small circle sits in the middle of each edge: drag it, or just click it, to add a vertex there. A vertex clicked twice in a row removes it, down to three.
- **On the sheet, in whole units.** Every shape stays inside the `viewBox`, and every coordinate is rounded.
- **One request per change.** A drag is saved once, on release. A click saves nothing.

### Keyboard

- Tab moves through the zones in paint order.
- Arrow keys move the focused zone by 1, or by 10 with Shift; each press is saved.
- `Delete` or `Backspace` asks before deleting the zone, and `Esc` clears the selection.
- The toolbar and the palette are one Tab stop each; the arrow keys, `Home` and `End` move inside them (roving tabindex, `lib/a11y/roving.ts`). The disabled "Delete zone" is skipped.

### Adding and deleting

- **New zones.** "+ Rectangle", "+ Circle" and "+ Polygon" add a `custom` zone near the middle of the sheet, sized to the sheet. Each further one is moved 50 units down and right; every fifth goes back to the middle.
  - It takes the first unused color of an eight-color palette: the demo office's five and three more.
  - It gets draft texts in both languages, since the API needs both.
  - A new polygon is an L of six points.
  - The new zone is selected once the server has given it an id.
- **Deleting.** "Delete zone" asks in the toolbar, with the focus on "Cancel".

### Panels

- **Zone panel:**
  - type;
  - color: the palette, or `#rrggbb` in a field;
  - the four texts of the page's language: the ones the canvas and the showcase show. The other language keeps its texts (a new zone's drafts) until the page can switch language.
- **Plan panel:** name, width, height, units per meter, background ("Blank sheet" or "Demo office artwork"). A changed size keeps the sheet's top-left corner and does not move the zones.
- **Fields save once**, when they are left or `Enter` is pressed, not on every keystroke. An empty or invalid text is not sent: the field says why ("Fill this in", "Use the form #rrggbb", "A number above 0") and keeps the text to fix. The message is the field's accessible description.

### Status line

The toolbar's `role="status"` line reads:

- "Saving…";
- "All changes saved";
- "Could not save. The change was undone.";
- "This plan was changed elsewhere and has been reloaded.";
- while the server cannot be reached, "No connection to the server. Changes are not saved until it is back.", with a "Try again" button. The plan stays on screen meanwhile.

## Data layer

```
cache ["plan", id]  =  the API's PlanResponse, as the server confirmed it
   ├─ showcase:  useQuery(select: toFloorPlan)             → FloorPlan
   └─ editor:    useEditedPlan = cache + pending edits      → PlanResponse
                                   (useMutationState)
```

- **The cache holds what the server confirmed.** The showcase and the editor share one entry, so a saved change shows on the showcase without a refetch.
- **Pending changes are drawn over it.** This is TanStack Query's "optimistic via the UI" pattern:
  - while a change's request is pending, the editor applies it to the confirmed plan (`withEdits` in `lib/api/edits.ts`);
  - when the request settles, the cache takes the server's answer and the change is dropped from the pending list;
  - a failed change therefore leaves the screen by itself, and an answer never overwrites a change still queued behind it.
- **One queue per plan.** All of a plan's changes share a mutation `scope`, so they are sent one at a time in the order they were made. Each takes its `version` from the cache when it is sent, after the answer to the one before, so two quick changes send versions 1 and 2, not 1 twice.
- **After an error the plan is reloaded** before the next queued change is sent. After a `409` this shows what changed, and the next change gets the current version.
- **`lib/api/client.ts`:** `request()` sends and reads JSON. An error answer becomes an `ApiError` with the API's message; a network error stays a `TypeError`, which the retry rules of phase 4 rely on.
- **`lib/api/plans.ts`:** one function per endpoint, typed with the generated request and response types.

## Code layout

```
frontend/src/
├── App.tsx                       routes, header
├── pages/                        ShowcasePage, PlansPage, PlanEditorPage, NotFoundPage, PageMain
├── components/
│   ├── Header/
│   ├── Plans/                    NewPlanForm, PlanList, PlanRow
│   ├── PlanEditor/               PlanEditor, EditorCanvas, EditorToolbar, ZonePanel, PlanPanel, Field;
│   │                             fakeEditorApi (test support)
│   └── Plan/shapes.tsx           shape drawing, shared with the showcase
└── lib/
    ├── api/                      client, plans, types, edits, mutations
    ├── editor/                   geometry (move, handles, vertices, cursors), pointer, newZone
    ├── a11y/roving.ts            one Tab stop per button group
    ├── i18n/format.ts            plural forms, {placeholders}, dates
    └── plan/defaults.ts          a new plan's sheet
```

**New dependencies:**
- `react-router` 8.5;
- for tests: `jsdom` 30, `@testing-library/react` 16, `@testing-library/dom` 10, `@testing-library/user-event` 14, `@testing-library/jest-dom` 7.

Component tests switch to jsdom with a comment on their first line; the other tests still run in Node.

**Texts.** Every new text of the interface is in `translations.ts` in English and Russian. Russian plural forms come from `Intl.PluralRules` ("1 зона, 2 зоны, 5 зон"). The page still has no language switch.

## Checks

| Suite | Covers |
| --- | --- |
| `lib/editor/geometry.test.ts` (19) | moving and clamping; each rect handle, flipping, minimum sizes; the circle handle; vertices; midpoints, inserting and removing vertices; cursor directions |
| `lib/editor/newZone.test.ts` (6) | placement, sizes, the L, the stagger, the palette, draft texts |
| `lib/editor/pointer.test.ts` (2), `lib/a11y/roving.test.ts` (4), `lib/i18n/format.test.ts` (4) | pointer → viewBox, also for an SVG without a size; arrow navigation; plural forms and dates |
| `lib/api/client.test.ts` (5), `plans.test.ts`, `edits.test.ts` (8) | `request()`; each endpoint's method, URL and body; pending edits over the confirmed plan |
| `lib/api/mutations.test.tsx` (7) | a change shows before the answer; two quick changes send versions 1 and 2; a refused change drops out; a `409` reloads; a change queued behind a `409` gets the new version; delete and create; plan changes |
| `pages/PlansPage.test.tsx` (7) | list, empty list, create and open, blank name, cancel and confirm delete, load error |
| `components/PlanEditor/PlanEditor.test.tsx` (15) | selecting, dragging, handles, vertices added and removed, the click threshold, focus, arrow keys, rollback, plan not found |
| `components/PlanEditor/PlanEditorPanels.test.tsx` (10) | adding each kind, deleting, texts, empty texts, type and color, plan fields, offline, Tab stops, undone and `409` messages |

Totals: frontend 178 (84 after phase 5); backend unchanged (43 unit, 42 e2e).

**Mutation checks**, each failing at least one test:

- no mutation scope;
- not waiting for the reload in `onError`;
- no pending edits drawn;
- the version taken when the change is made instead of when it is sent;
- the released shape taken from the last move instead of the release;
- a midpoint click adding nothing;
- no focus on a pressed zone, or on "Cancel";
- a click threshold of 0;
- the error screen replacing a loaded plan;
- fields saving on every keystroke;
- a new zone not selected;
- no conflict message;
- a blank plan name sent;
- the plans list not refreshed after a delete.

**In the browser.** Headless Edge with real mouse and keyboard events through the DevTools protocol, on test plans created and deleted through the API:

- a dragged zone stays where it is dropped, read every 16 ms after release;
- a resize is saved;
- three zones are added with their colors, and a text is renamed;
- a change made through the API behind the editor's back gives the `409` message and shows the other change;
- the narrow-screen note shows;
- a click puts the focus on a zone, and Tab goes on to the next zone;
- vertex cursors point away from the center;
- a dragged midpoint adds a vertex;
- a double click with 2 px of jitter removes a vertex with a single request.

**The showcase.** The 18 screenshots of phases 4–5 (desktop, mobile sheet and preview, hint, hover; English and Russian; with and without reduced motion), from `main` and from the branch with the header hidden:

- `main` shot twice: 18 of 18 identical;
- the branch's second run against both runs of `main`: 18 of 18 identical;
- only the branch's first run differed, in 12 shots with selected zones, against its own second run as well, so the difference was in the browser session, not in the code (see [Findings](#findings)).

## Findings

- **A pending change reaches React a moment later.** TanStack Query notifies through `setTimeout(0)`, so a zone released after a drag could show its old shape for a frame. The canvas keeps the dragged shape until the plan shows it, or a save fails. jsdom does not show the jump; it was checked in the browser.
- **`preventDefault()` on `pointerdown` also cancels `dblclick`.** It keeps the focus on the pressed zone, but it stops the mouse events that follow pointer events, so a vertex double click never arrived. The canvas counts two clicks on one vertex within 400 ms itself. A test calling `dblclick` directly had passed.
- **A hand never holds a pointer still.** Without the 4 px threshold, the first click of a double click moved the vertex by a unit and was saved as a move.
- **A refetch error keeps the data.** TanStack Query sets `isError` and keeps `data`, so the editor must check for a plan, not for an error. Checking for the error replaced the plan with the error screen when the server went away.
- **`409` between two tabs is rare by design.** Switching to a tab refetches the plan (`refetchOnWindowFocus`), so a tab usually has the current versions before it is edited. A `409` comes when the plan changes while it stays focused; live updates are phase 7.
- **`autoFocus` did not focus "Cancel" in the editor's toolbar**, while the same pattern works on the plans page. An explicit `focus()` in an effect does.
- **An SVG without a size turned a click into `NaN`.** A drag on an unlaid-out SVG (in jsdom, or a hidden one) sent `cx: null`. Points now map to the corner of the `viewBox` then, so nothing moves.
- **React Compiler's lint rejects `setState` in effects.** The canvas's draft and the fields' text follow their props by adjusting state during render, as React recommends.
- **Byte-identical screenshots need a careful setup:**
  - the header moves the page, which changes the antialiasing of the tilted sheet, so the branch is shot with it hidden;
  - text renders differently in some browser sessions, so both versions are shot back to back and each twice;
  - the screenshot script left Edge's child processes running (74 of them), which held the debugging port; it now ends the whole process tree.

## Deviations from the plan

- **Pending changes are drawn over the cache, not written into it** (step 3), and **all of a plan's changes share one queue**, not one per zone, so a delete cannot overtake a change of the same zone.
- **Polygons get and lose vertices** (decision 3 said they would not). Added after trying the editor: an L of six points was too little to draw a real room.
- **The zone panel edits the page's language only** (decision 2 named both). Russian fields changed nothing visible while the page is in English.
- **Tab stops** were reduced after trying the editor: a pressed zone takes the focus, and the toolbar and the palette are one stop each.
- **The editor survives a lost server** with a status message and "Try again"; the plan had not covered a failed reload.
- **The canvas shows names, not area captions**, and the editor's heading is the plan's name.

## Known gaps

- **No selecting of several zones**, no undo, no copy and paste. Several zones at once is in the roadmap's [later list](phase-0-roadmap.md#later).
- **Curved polygon edges** are points; Bézier edges are in the [later list](phase-0-roadmap.md#later).
- **Resizing and vertex editing need a pointer;** the keyboard moves zones only.
- **Russian zone texts** cannot be edited in the browser until the page can switch language.
- **`zIndex`, `hitPadding` and the label offset** are not editable, and polygons may cross themselves.
- **A change queued behind a `409` is sent with the reloaded version**, so it overwrites the other change in the fields it sets.
- **The demo office is editable**, and changes show on the showcase; `npm run db:seed` restores it (roadmap open question 1).
