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

The geometry is also incomplete. The **open floor** is drawn as a rectangle covering only the corridor. The real zone is L-shaped: it also includes the lower-right area next to the break room and the curved bay on the right, where the signature corner sits. That lower part is not clickable today and never gets the marker.

## Target model

```ts
// src/lib/plan/types.ts
export type Shape =
  | { kind: "rect"; x: number; y: number; width: number; height: number; rx: number }
  | { kind: "circle"; cx: number; cy: number; r: number }
  | { kind: "polygon"; points: [number, number][] }; // curves approximated by points

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
  label?: { dx: number; dy: number; fontSize?: number; areaDy?: number }; // offset from the shape center; area caption areaDy below (default 22)
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
| marker strokes and rotation | `generateMarkerStrokes(shape, seed)`: horizontal scanlines across the shape, one stroke per interval where the line is inside the shape (so concave polygons work), with small deterministic jitter and tilt seeded from the zone id. They look hand-drawn but never change between renders. |
| label position | shape center + optional `label.dx/dy` (the current positions are kept as offsets, because they avoid the furniture). The area caption sits `label.areaDy` below the name: 22 by default, 34 in the meeting room, where it sits inside the drawn table |
| area caption `"≈ 28 m²"` | `area(shape) / pxPerMeter²`, rounded. Each zone counts its own full shape: zones drawn on top (higher `zIndex`) are **not** subtracted. The signature corner sits on top of the open floor, and the floor under it still belongs to the open floor. |
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
2. **Types and geometry.** Add `types.ts` and `geometry.ts` with tests for rect, circle and polygon:
   - area (polygon via the shoelace formula), center, bounds;
   - scanline intervals (one or more per line for concave polygons);
   - hit padding: rect and circle grow geometrically; a polygon gets a transparent stroke `2 × padding` wide that still receives pointer events.
3. **Markers.** Add `random.ts` and `markers.ts` with tests:
   - the same seed gives the same strokes;
   - strokes stay inside the shape;
   - the stroke count grows with height;
   - circles get shorter strokes near the top and bottom;
   - an L-shaped polygon gets strokes in both of its parts.
4. **Demo plan.** Add `demoPlan.ts` holding the current geometry, colors and EN / RU copy in the new model. The open floor is redrawn as an L-shaped polygon traced along the inner walls, with the right-hand bay approximated by points. Tests: unique ids, unique `zIndex`, both languages present, `shape` valid.
5. **Switch the map to the model.** `SpaceMapperPlan`, `SpaceMapperPanel` and `SpaceMapper` read from `FloorPlan`. Remove the old maps and `zoneData.ts`, and move the static artwork into `PlanBackground.tsx`.
6. **Visual check.** Compare the map before and after at desktop and mobile widths, in EN and RU, with and without reduced motion. Attach before and after screenshots to the PR.
7. **Docs.** Write `phase-1-zone-model.md` and update the known gaps in `phase-0-frontend-port.md`.

## Acceptance criteria

- [x] Every per-zone value lives in `demoPlan.ts`. `SpaceMapperPlan.tsx` contains no zone ids, coordinates or colors.
- [x] Adding a zone to `demoPlan.ts` is enough for it to be clickable, highlighted, labelled, listed in the legend and shown in the panel.
- [x] Marker strokes, area captions and legend are computed, and stay stable between renders.
- [x] Behaviour is unchanged: multi-select, hover, keyboard, hint, mobile sheet, reduced motion.
- [ ] `npm test` passes in CI, and geometry and markers are covered.
- [ ] `lint`, `typecheck` and `build` stay green.

## Expected visual differences

- **Marker strokes** will be generated rather than hand-placed. They will look similar (same color, opacity, width and slight tilt), but not identical.
- **Hover tints** for meeting room, break room and signature corner currently use colors that differ from their marker colors. They will switch to the marker color at the same alpha.
- **Open floor** becomes L-shaped. The lower-right area and the right-hand bay become clickable, show the hover tint and get marker strokes. Under the signature corner its strokes stay visible: the circle has no fill and the strokes are translucent, so when both zones are selected their colors mix there (see decision 5). To keep the mix clean, the signature corner changes from mauve `#9A7A8C` (nearly opposite the open floor's green, so the overlap turned grey) to dusty blue `#4F7CAC`.
- **Area captions** become computed. At 32 px per meter (the scale where reception is exactly 28 m²) the expected values are:

  | Zone | Label now | Computed |
  | --- | --- | --- |
  | Reception | 28 | 28 |
  | Meeting room | 32 | 31 |
  | Open floor | 96 | 82 (inset from the walls like the other rooms: 6 from the outer wall, 8 from inner walls; along the wall lines it would be ≈ 95) |
  | Break room | 24 | 23 |
  | Signature corner | 14 | 14 |

## Decisions

1. **Open floor shape.** The open floor is an L-shaped polygon: the corridor, the lower-right area next to the break room and the curved bay on the right. *(Decided 2026-10-28.)*
2. **Overlapping zones.** The signature corner is a separate zone drawn on top of the open floor. Overlaps are not subtracted, so the open floor's area includes the floor under the circle. *(Decided 2026-10-28.)*
3. **Areas are always computed** from the geometry. There is no `areaOverride` field. *(Decided 2026-10-28.)*
4. **Polygons arrive in phase 1, not phase 6.** The open floor needs a polygon now. Phase 6 only adds drawing and editing them in the UI.
5. **Overlapping markers are not masked.** Where zones overlap, each zone draws its full set of strokes and the translucent colors mix. *(Decided 2026-10-28.)*

## Out of scope

- Backend, API and database (phases 2–5).
- Editing zones in the UI (phase 6).
- Walls and furniture as data.
- Splitting the providers to clear the `only-export-components` warnings.
