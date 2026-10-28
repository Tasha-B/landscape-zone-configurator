# Phase 1 — Zone model: plan

Part of the [roadmap](phase-0-roadmap.md). The result will be recorded in `phase-1-zone-model.md`.

## Goal

Replace the scattered, hand-placed zone data with **one `Zone` record per zone**, from which everything on the map is rendered or computed. The record has the same shape the database will store in phase 3, so switching from static data to the API in phase 4 changes where zones come from, not what they are.

The map must look and behave the same as now. Visual differences are allowed only where this plan lists them.

## Where we are

The data for one zone is spread over five structures in two files, all keyed by zone id:

| Structure | File | Holds |
| --- | --- | --- |
| `spaceZones` | `zoneData.ts` | EN / RU copy |
| `zoneShapes` | `SpaceMapperPlan.tsx` | geometry (`rect` / `circle`) |
| `zoneMarkerGroups` | `SpaceMapperPlan.tsx` | 4–6 hand-placed marker strokes, rotation, color |
| `zoneLabelInfo` | `SpaceMapperPlan.tsx` | hand-placed label and area-caption positions, font size, area as a string (`"≈ 28 m²"`) |
| `zoneHoverColor` | `SpaceMapperPlan.tsx` | hover tint per zone |

`zoneRenderOrder`, `hitAreaPaddingOverrides` and `PALETTE_SWATCHES` repeat zone ids and colors once more. Adding, moving or resizing a zone means editing every one of these by hand, which an editor (phase 6) cannot do.

## Target model

```ts
// src/lib/plan/types.ts
export type Shape =
  | { kind: "rect"; x: number; y: number; width: number; height: number; rx: number }
  | { kind: "circle"; cx: number; cy: number; r: number };

export type ZoneType =
  | "reception" | "meeting-room" | "open-floor" | "break-room" | "signature-corner" | "custom";

export interface ZoneContent {
  name: string;
  tagline: string;
  recommendation: string;
  rationale: string;
}

export interface Zone {
  id: string;                         // uuid once it comes from the DB
  type: ZoneType;
  shape: Shape;
  color: string;                      // marker, hover tint and legend swatch
  zIndex: number;                     // paint and tab order
  hitPadding?: number;                // default 20; signature corner uses 0
  label?: { dx: number; dy: number; fontSize?: number }; // offset from the shape center
  content: Record<Lang, ZoneContent>;
}

export interface FloorPlan {
  id: string;
  name: string;
  viewBox: [number, number, number, number];
  pxPerMeter: number;
  zones: Zone[];                      // array order = legend order
}
```

**What is computed instead of stored:**

| Was stored | Becomes |
| --- | --- |
| marker strokes and rotation | `generateMarkerStrokes(shape, seed)`: horizontal strokes across the shape with small deterministic jitter and tilt, seeded from the zone id so they look hand-drawn but never change between renders |
| label position | shape center + optional `label.dx/dy` (the current positions are kept as offsets, because they avoid the furniture) |
| area caption `"≈ 28 m²"` | `area(shape) / pxPerMeter²`, rounded |
| hover color | `color` at fixed alpha |
| render order, padding overrides | `zIndex`, `hitPadding` |
| palette legend | `plan.zones` mapped to swatches |

The walls, furniture, trees, compass and sheet title stay as static SVG in a `PlanBackground` component. They become data only if the editor needs them (not in this roadmap).

## Files

```
frontend/src/
├── lib/plan/
│   ├── types.ts            Shape, Zone, FloorPlan
│   ├── geometry.ts         area, center, bounds, padShape
│   ├── geometry.test.ts
│   ├── markers.ts          generateMarkerStrokes
│   ├── markers.test.ts
│   └── random.ts           seeded PRNG (mulberry32 + string hash)
├── data/
│   ├── demoPlan.ts         the current 5 zones as one FloorPlan (becomes the DB seed in phase 3)
│   └── demoPlan.test.ts
└── components/SpaceMapper/
    ├── SpaceMapperPlan.tsx       renders from FloorPlan; data maps removed
    ├── PlanBackground.tsx        static artwork moved out of SpaceMapperPlan
    └── zoneData.ts               removed (copy moves into demoPlan.ts)
```

## Steps

Each step is a separate commit, and the app builds after every one.

1. **Tests setup.** Add Vitest, an `npm test` script and a `Test` step in CI.
2. **Types and geometry.** Add `types.ts` and `geometry.ts` with tests: rect and circle area, center, bounds, padding.
3. **Markers.** Add `random.ts` and `markers.ts` with tests: same seed gives same strokes, strokes stay inside the shape bounds, stroke count grows with height, circles get shorter strokes near the top and bottom.
4. **Demo plan.** Add `demoPlan.ts` holding the current geometry, colors and EN / RU copy in the new model, with tests: unique ids, unique `zIndex`, both languages present, `shape` valid.
5. **Switch the map to the model.** `SpaceMapperPlan`, `SpaceMapperPanel` and `SpaceMapper` read from `FloorPlan`. Remove the old maps and `zoneData.ts`, and move the static artwork into `PlanBackground.tsx`.
6. **Visual check.** Compare the map before and after at desktop and mobile widths, in EN and RU, with and without reduced motion. Attach before and after screenshots to the PR.
7. **Docs.** Write `phase-1-zone-model.md` and update the known gaps in `phase-0-frontend-port.md`.

## Acceptance criteria

- [ ] Every per-zone value lives in `demoPlan.ts`. `SpaceMapperPlan.tsx` contains no zone ids, coordinates or colors.
- [ ] Adding a zone to `demoPlan.ts` is enough for it to be clickable, highlighted, labelled, listed in the legend and shown in the panel.
- [ ] Marker strokes, area captions and legend are computed, and stay stable between renders.
- [ ] Behaviour is unchanged: multi-select, hover, keyboard, hint, mobile sheet, reduced motion.
- [ ] `npm test` passes in CI, and geometry and markers are covered.
- [ ] `lint`, `typecheck` and `build` stay green.

## Expected visual differences

- **Marker strokes** will be generated rather than hand-placed. They will look similar (same color, opacity, width and slight tilt), but not identical.
- **Hover tints** for meeting room, break room and signature corner currently use colors that differ from their marker colors. They will switch to the marker color at the same alpha.
- **Area captions** become computed (see open question 1).

## Open questions

1. **Open floor area.** At 32 px per meter (the scale where reception is exactly 28 m²), the computed areas are reception 28, meeting room 31 (now labelled 32), break room 23 (now 24), signature corner 14 (now 14), and **open floor 43 (now labelled 96)**. Options:
   - **a. Trust the geometry** and show 43 m². This is consistent, and the sheet already says "not to scale". *(recommended)*
   - b. Add an optional `areaOverride` to `Zone` for the design copy. This is simple, but it brings back hand-maintained data.
2. **Polygon zones.** L-shaped rooms will need `kind: "polygon"`. The proposal is to add it in phase 6, together with the editor that can draw it, not now.

## Out of scope

- Backend, API and database (phases 2–5).
- Editing zones in the UI (phase 6).
- Walls and furniture as data.
- Splitting the providers to clear the `only-export-components` warnings.
