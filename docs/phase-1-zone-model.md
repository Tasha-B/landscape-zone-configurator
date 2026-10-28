# Phase 1 — Zone model

Part of the [roadmap](phase-0-roadmap.md). The plan and the decisions behind it are in [phase-1-zone-model-plan.md](phase-1-zone-model-plan.md).

Each zone is now **one `Zone` record**, and everything the map shows for a zone is rendered or computed from it: hit area, hover tint, marker strokes, label, area caption, legend swatch and the recommendation card. The five zones of the demo office live in a single `FloorPlan`, `src/data/demoPlan.ts`, which becomes the database seed in phase 3.

Adding a zone to `demoPlan.ts` is enough for it to be clickable, highlighted, labelled, listed in the legend and shown in the panel.

## Model

```ts
// src/lib/plan/types.ts
type Shape =
  | { kind: "rect"; x: number; y: number; width: number; height: number; rx: number }
  | { kind: "circle"; cx: number; cy: number; r: number }
  | { kind: "polygon"; points: [number, number][] };

interface Zone {
  id: string;
  type: ZoneType;
  shape: Shape;
  color: string;          // marker, hover tint and legend swatch
  zIndex: number;         // paint and tab order
  hitPadding?: number;    // default 20
  label?: { dx: number; dy: number; fontSize?: number; areaDy?: number };
  content: Record<Lang, ZoneContent>;
}

interface FloorPlan {
  id: string;
  name: string;
  viewBox: [number, number, number, number];
  pxPerMeter: number;
  zones: Zone[];          // array order = legend order
}
```

Compared with the plan, `label` gained `areaDy`: the meeting room's area caption sits 34 units below its name, inside the drawn table, instead of the default 22.

## What is computed

| Value | How |
| --- | --- |
| Marker strokes | `generateMarkerStrokes(shape, zone.id)`, see below |
| Label position | `center(shape)` + `label.dx/dy`; the caption is `label.areaDy` below it |
| Area caption | `area(shape) / pxPerMeter²`, rounded. Overlaps are not subtracted |
| Hover tint | `color` at alpha 0.12 |
| Hit area | `padShape(shape, hitPadding)`: rects and circles grow; a polygon gets a transparent stroke `2 × padding` wide |
| Paint and tab order | zones sorted by `zIndex` |
| Legend | `plan.zones` in array order |

### Marker strokes

`src/lib/plan/markers.ts` fills a shape with horizontal highlighter strokes:

- Rows are 22 units apart with a 13-unit margin from the top and bottom edges. With these values every phase 0 shape gets the number of rows it had when the strokes were hand-placed.
- Each row yields one stroke per run where the row is inside the shape, so concave polygons work: the L-shaped open floor gets strokes in both of its parts.
- Each zone gets one tilt of 1–2° (right end up). Strokes stop 0–5 units short of the wall on the left and 1–13 on the right, past the round cap, which is what the hand-drawn strokes did.
- A stroke never leaves its shape. Its endpoints stay within ±5 units of the row, and the stroke is kept inside the runs that are inside the shape across that whole band: the band edges are sampled, and for a polygon also every vertex inside the band, so the guarantee is exact.
- The randomness is seeded with the zone id (FNV-1a hash + mulberry32, `src/lib/plan/random.ts`), so strokes are identical on every render and reload.

Strokes are generated once per plan (`useMemo`) and keep the existing draw, fade and hint animations.

### Geometry

`src/lib/plan/geometry.ts` holds pure functions over a `Shape`: `area` (shoelace formula for polygons; rounded corners are subtracted from rects), `bounds`, `center` (area centroid), `scanlineIntervals` (even-odd rule, one or more runs per line) and `padShape`. `rx` is clamped to half the shorter side, the same way SVG draws it.

## The demo plan

| Zone | Shape | Area | `zIndex` |
| --- | --- | --- | --- |
| Reception | rect | 28 m² | 1 |
| Meeting room | rect | 31 m² | 2 |
| Open floor | polygon, L-shaped | 82 m² | 0 |
| Break room | rect | 23 m² | 3 |
| Signature corner | circle, `hitPadding: 0` | 14 m² | 4 |

The scale is 32 px per meter, the one at which reception is exactly 28 m².

**Open floor.** It was a rectangle covering only the corridor. It is now a polygon traced along the inner walls: the corridor, the area right of the break room, and the curved bay. The bay follows the outer wall's Bézier curve, sampled at 12 points. Like the other rooms, it is inset from the wall lines (6 units from the outer wall, 8 from inner walls), which is why it computes to 82 m², not the ≈ 90 estimated in the plan.

**Signature corner.** It sits on top of the open floor. The floor under it still counts towards the open floor's area, and where both are selected their translucent strokes mix (plan decision 5). Its color changed from mauve `#9A7A8C` to dusty blue `#4F7CAC`. Mauve is nearly opposite the open floor's green, so the overlap turned grey. Blue is its neighbour on the color wheel and mixes cleanly.

## Files

```
frontend/src/
├── lib/plan/
│   ├── types.ts                Shape, Zone, FloorPlan
│   ├── geometry.ts             area, bounds, center, scanlineIntervals, padShape
│   ├── markers.ts              generateMarkerStrokes
│   └── random.ts               seeded PRNG
├── data/
│   └── demoPlan.ts             the 5 zones as one FloorPlan
└── components/SpaceMapper/
    ├── SpaceMapperPlan.tsx     renders zones from a FloorPlan (`plan` prop); no zone ids, coordinates or colors
    ├── PlanBackground.tsx      walls, doors, furniture, trees and annotations; HINT_ZONE_ID
    └── zoneData.ts             removed
```

`SpaceMapper` passes `demoPlan` down. `SpaceMapperPanel` and `RecommendationCard` take `Zone` and `ZoneContent`. `SpaceMapperPlan.tsx` went from 633 to 365 lines.

## Tests

Vitest was added (`npm test`, `npm run test:watch`). CI runs it as a `Test` step. The job keeps its name, `Frontend — lint, typecheck, build`, because the `main` ruleset requires a check with that exact name.

| File | Covers |
| --- | --- |
| `geometry.test.ts` | area, bounds, center and scanline runs for rect, rounded rect, circle, L- and U-shaped polygons; vertices on the scanline; point order; hit padding |
| `random.test.ts` | same seed gives the same sequence, values in [0, 1) |
| `markers.test.ts` | determinism; strokes stay inside rect, circle and concave polygons for several seeds; phase 0 row counts; count grows with height; shorter circle strokes near the top and bottom; L-shape gets strokes in both parts; tilt |
| `demoPlan.test.ts` | unique ids and `zIndex`; content in every language; valid shapes inside the viewBox; no self-intersecting polygon; phase 0 label positions; areas; the open floor reaches the lower-right area and the bay |
| `translations.test.ts` | no blank UI strings |

There are 73 tests. The "strokes stay inside" test for a polygon notch was checked by mutation: with vertex sampling switched off, it fails.

## Visual check

The map was compared before (`f2fd106`) and after at desktop (1400 px) and mobile (390 px) widths, in EN and RU, with and without reduced motion, plus hover over the new parts of the open floor. The before and after screenshots are attached to the phase 1 pull request.

Only the differences listed in the plan were found:

- Marker strokes are generated. They have the same color, opacity, width and slight tilt, and the same number of rows.
- The open floor is L-shaped. The area right of the break room and the bay are now clickable, show the hover tint and get strokes.
- Area captions are computed: meeting room 32 → 31, open floor 96 → 82, break room 24 → 23.
- Hover tints use the zone color at one alpha. The meeting room, break room and signature corner used to have their own tint colors.
- The signature corner is dusty blue.

Walls, doors, furniture, fonts, the legend layout, copy, the panel, the mobile sheet and the one-shot reception hint are unchanged.

## Known gaps

- **Labels follow the centroid.** A label is an offset from its shape's centroid, so reshaping a zone moves its label, and the open floor's offset is large (`dx: -163`) because its centroid lies in the lower-right part. The editor (phase 6) will need draggable labels.
- **The artwork is for the demo office only.** Walls, doors, furniture and the "tap a zone" arrow are static SVG in `PlanBackground`. The hint plays on `HINT_ZONE_ID = "reception"`, the zone the arrow points at. A plan without that zone gets no hint.
- **Keyboard focus ring of a polygon** is drawn on its outline, while rects and circles show it on their padded hit area.
- **The language cannot be switched in the UI.** `LanguageProvider` starts in English. This predates phase 1. For the RU screenshots the default was changed locally.
- Oxlint still reports the two `only-export-components` warnings from phase 0.
