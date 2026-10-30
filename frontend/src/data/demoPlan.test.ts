import { describe, expect, it } from "vitest";
import { translations, type Lang } from "../lib/i18n/translations";
import { area, bounds, center, scanlineIntervals } from "../lib/plan/geometry";
import { generateMarkerStrokes } from "../lib/plan/markers";
import type { Point, Shape } from "../lib/plan/types";
// The demo data lives with the database seed; the checks need the
// frontend's geometry, so they stay here
import { demoPlan } from "../../../backend/prisma/demo-plan-data";

const zone = (id: string) => demoPlan.zones.find((z) => z.id === id)!;

function isInside(shape: Shape, [x, y]: Point) {
  return scanlineIntervals(shape, y).some(([from, to]) => x >= from && x <= to);
}

// Proper crossing of segments ab and cd (touching ends do not count)
function segmentsCross(a: Point, b: Point, c: Point, d: Point) {
  const side = (p: Point, q: Point, r: Point) => Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]));
  return side(a, b, c) * side(a, b, d) < 0 && side(c, d, a) * side(c, d, b) < 0;
}

function isSimplePolygon(points: Point[]) {
  const n = points.length;
  for (let i = 0; i < n; i++) {
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue; // adjacent through the closing edge
      if (segmentsCross(points[i], points[(i + 1) % n], points[j], points[(j + 1) % n])) return false;
    }
  }
  return true;
}

describe("demoPlan", () => {
  it("has unique zone ids", () => {
    const ids = demoPlan.zones.map((z) => z.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("has unique zIndex values", () => {
    const zIndexes = demoPlan.zones.map((z) => z.zIndex);
    expect(new Set(zIndexes).size).toBe(zIndexes.length);
  });

  it("draws the open floor first, so every other zone sits on top of it", () => {
    expect(Math.min(...demoPlan.zones.map((z) => z.zIndex))).toBe(zone("open-floor").zIndex);
  });

  it.each(demoPlan.zones.map((z) => [z.id, z] as const))("%s: has content in every language", (_, z) => {
    for (const lang of Object.keys(translations) as Lang[]) {
      const content = z.content[lang];
      expect(content, lang).toBeDefined();
      for (const [field, value] of Object.entries(content)) {
        expect(value.trim(), `${lang}.${field}`).not.toBe("");
      }
    }
  });

  it.each(demoPlan.zones.map((z) => [z.id, z] as const))("%s: has a valid shape inside the viewBox", (_, z) => {
    const { shape } = z;
    const numbers =
      shape.kind === "polygon" ? shape.points.flat() : Object.values(shape).filter((v) => typeof v === "number");
    expect(numbers.every(Number.isFinite)).toBe(true);

    if (shape.kind === "rect") {
      expect(shape.width).toBeGreaterThan(0);
      expect(shape.height).toBeGreaterThan(0);
      expect(shape.rx).toBeGreaterThanOrEqual(0);
    }
    if (shape.kind === "circle") expect(shape.r).toBeGreaterThan(0);
    if (shape.kind === "polygon") {
      expect(shape.points.length).toBeGreaterThanOrEqual(3);
      expect(isSimplePolygon(shape.points)).toBe(true);
    }
    expect(area(shape)).toBeGreaterThan(0);

    const [vx, vy, vw, vh] = demoPlan.viewBox;
    const b = bounds(shape);
    expect(b.x).toBeGreaterThanOrEqual(vx);
    expect(b.y).toBeGreaterThanOrEqual(vy);
    expect(b.x + b.width).toBeLessThanOrEqual(vx + vw);
    expect(b.y + b.height).toBeLessThanOrEqual(vy + vh);
  });

  it.each(demoPlan.zones.map((z) => [z.id, z] as const))("%s: has a #RRGGBB color and valid padding", (_, z) => {
    expect(z.color).toMatch(/^#[0-9A-F]{6}$/i);
    expect(z.hitPadding ?? 0).toBeGreaterThanOrEqual(0);
  });

  it.each(demoPlan.zones.map((z) => [z.id, z] as const))("%s: label anchor lies inside the zone", (_, z) => {
    const [cx, cy] = center(z.shape);
    const anchor: Point = [cx + (z.label?.dx ?? 0), cy + (z.label?.dy ?? 0)];
    expect(isInside(z.shape, anchor)).toBe(true);
  });

  it("keeps the label positions of phase 0", () => {
    const anchors = Object.fromEntries(
      demoPlan.zones.map((z) => {
        const [cx, cy] = center(z.shape);
        return [z.id, [Math.round(cx + (z.label?.dx ?? 0)), Math.round(cy + (z.label?.dy ?? 0))]];
      }),
    );
    expect(anchors).toEqual({
      reception: [226, 146],
      "meeting-room": [435, 140],
      "open-floor": [240, 292],
      "break-room": [200, 400],
      "signature-corner": [588, 376],
    });
  });

  it("computes the expected areas in m²", () => {
    const m2 = Object.fromEntries(
      demoPlan.zones.map((z) => [z.id, Math.round(area(z.shape) / demoPlan.pxPerMeter ** 2)]),
    );
    expect(m2).toEqual({
      reception: 28,
      "meeting-room": 31,
      "open-floor": 82,
      "break-room": 23,
      "signature-corner": 14,
    });
  });

  it("open floor reaches the lower-right area and the bay", () => {
    const shape = zone("open-floor").shape;
    expect(isInside(shape, [440, 420])).toBe(true); // right of the break room
    expect(isInside(shape, [640, 385])).toBe(true); // bay, right of the signature corner
    expect(isInside(shape, [200, 420])).toBe(false); // break room is not part of it

    const strokes = generateMarkerStrokes(shape, "open-floor");
    expect(strokes.some((s) => s.y1 > 350 && s.x1 > 328)).toBe(true);
  });

  it("every zone gets marker strokes", () => {
    for (const z of demoPlan.zones) {
      expect(generateMarkerStrokes(z.shape, z.id).length, z.id).toBeGreaterThan(0);
    }
  });
});
