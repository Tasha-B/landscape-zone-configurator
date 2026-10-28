import { describe, expect, it } from "vitest";
import { scanlineIntervals } from "./geometry";
import { generateMarkerStrokes, type MarkerStroke } from "./markers";
import type { Point, Shape } from "./types";

const rect = (x: number, y: number, width: number, height: number, rx = 4): Shape => ({
  kind: "rect",
  x,
  y,
  width,
  height,
  rx,
});
const polygon = (...points: Point[]): Shape => ({ kind: "polygon", points });

// Phase 0 geometry (viewBox 0 0 800 600)
const reception = rect(88, 98, 214, 134);
const openFloorCorridor = rect(88, 248, 464, 94);
const breakRoom = rect(88, 358, 224, 104);
const signatureCorner: Shape = { kind: "circle", cx: 588, cy: 385, r: 68 };

// 300 × 60 bar with a 100 × 100 leg under its left end
const lShape = polygon([0, 0], [300, 0], [300, 60], [100, 60], [100, 160], [0, 160]);
// 300 × 160 block with a 100 × 100 notch cut up from the middle of the bottom
const uShape = polygon([0, 0], [300, 0], [300, 160], [200, 160], [200, 60], [100, 60], [100, 160], [0, 160]);
// 300 × 140 block with a thin wedge cut in from the right, apex at (60, 59).
// The apex sits on a row (rows are at y = 15, 37, 59, …) and the wedge is
// only 18 tall, so both band ends of that row miss it: strokes cut deep
// into the wedge unless the apex is sampled.
const sideNotch = polygon([0, 0], [300, 0], [300, 50], [60, 59], [300, 68], [300, 140], [0, 140]);

const length = (s: MarkerStroke) => Math.hypot(s.x2 - s.x1, s.y2 - s.y1);

function isInside(shape: Shape, x: number, y: number) {
  const eps = 1e-9;
  return scanlineIntervals(shape, y).some(([from, to]) => x >= from - eps && x <= to + eps);
}

describe("generateMarkerStrokes", () => {
  it("gives the same strokes for the same seed", () => {
    expect(generateMarkerStrokes(lShape, "open-floor")).toEqual(generateMarkerStrokes(lShape, "open-floor"));
  });

  it("gives different strokes for different seeds", () => {
    expect(generateMarkerStrokes(reception, "a")).not.toEqual(generateMarkerStrokes(reception, "b"));
  });

  const shapes: [string, Shape][] = [
    ["rect", reception],
    ["circle", signatureCorner],
    ["L-shape", lShape],
    ["U-shape", uShape],
    ["side notch", sideNotch],
  ];

  it.each(shapes)("%s: strokes stay inside the shape", (_, shape) => {
    for (const seed of ["a", "b", "c", "d", "e", "f", "g", "h"]) {
      const strokes = generateMarkerStrokes(shape, seed);
      expect(strokes.length).toBeGreaterThan(0);
      for (const s of strokes) {
        for (let t = 0; t <= 1; t += 0.05) {
          const x = s.x1 + (s.x2 - s.x1) * t;
          const y = s.y1 + (s.y2 - s.y1) * t;
          expect(isInside(shape, x, y), `seed ${seed}: (${x}, ${y})`).toBe(true);
        }
      }
    }
  });

  it("keeps the row counts of the hand-placed phase 0 strokes", () => {
    expect(generateMarkerStrokes(reception, "reception")).toHaveLength(5);
    expect(generateMarkerStrokes(openFloorCorridor, "open-floor")).toHaveLength(4);
    expect(generateMarkerStrokes(breakRoom, "break-room")).toHaveLength(4);
    expect(generateMarkerStrokes(signatureCorner, "signature-corner")).toHaveLength(6);
  });

  it("stroke count grows with height", () => {
    const counts = [40, 70, 100, 140, 200].map(
      (height) => generateMarkerStrokes(rect(0, 0, 200, height), "h").length,
    );
    for (let i = 1; i < counts.length; i++) {
      expect(counts[i]).toBeGreaterThanOrEqual(counts[i - 1]);
    }
    expect(counts.at(-1)).toBeGreaterThan(counts[0]);
  });

  it("circle strokes are shorter near the top and bottom", () => {
    const strokes = generateMarkerStrokes(signatureCorner, "signature-corner");
    const middle = length(strokes[Math.floor(strokes.length / 2)]);
    expect(length(strokes[0])).toBeLessThan(middle);
    expect(length(strokes.at(-1)!)).toBeLessThan(middle);
  });

  it("L-shape gets strokes in both of its parts", () => {
    const strokes = generateMarkerStrokes(lShape, "open-floor");
    const bar = strokes.filter((s) => s.y1 < 60);
    const leg = strokes.filter((s) => s.y1 > 60);
    expect(bar.some((s) => s.x2 > 200)).toBe(true);
    expect(leg.length).toBeGreaterThan(0);
    expect(leg.every((s) => s.x2 <= 100)).toBe(true);
  });

  it("concave polygon gets separate strokes on each side of a notch", () => {
    const lower = generateMarkerStrokes(uShape, "u").filter((s) => s.y1 > 80);
    expect(lower.some((s) => s.x2 <= 100)).toBe(true);
    expect(lower.some((s) => s.x1 >= 200)).toBe(true);
    expect(lower.some((s) => s.x1 < 100 && s.x2 > 200)).toBe(false);
  });

  it("tilts every stroke slightly, right end up", () => {
    for (const s of generateMarkerStrokes(openFloorCorridor, "open-floor")) {
      const degrees = (Math.atan2(s.y1 - s.y2, s.x2 - s.x1) * 180) / Math.PI;
      expect(degrees).toBeGreaterThan(0);
      expect(degrees).toBeLessThan(3);
    }
  });

  it("gives no strokes for a shape too small to hold one", () => {
    expect(generateMarkerStrokes(rect(0, 0, 20, 20), "tiny")).toEqual([]);
  });
});
