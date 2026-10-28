import { describe, expect, it } from "vitest";
import { area, bounds, center, padShape, scanlineIntervals } from "./geometry";
import type { Point, Shape } from "./types";

const rect = (x: number, y: number, width: number, height: number, rx = 0): Shape => ({
  kind: "rect",
  x,
  y,
  width,
  height,
  rx,
});
const circle = (cx: number, cy: number, r: number): Shape => ({ kind: "circle", cx, cy, r });
const polygon = (...points: Point[]): Shape => ({ kind: "polygon", points });

// 20 × 10 bar on top, 10 × 10 leg below its left half
const lPoints: Point[] = [[0, 0], [20, 0], [20, 10], [10, 10], [10, 20], [0, 20]];
const lShape = polygon(...lPoints);
// 30 × 20 block with a 10 × 10 notch cut up from the middle of the bottom
const uPoints: Point[] = [[0, 0], [30, 0], [30, 20], [20, 20], [20, 10], [10, 10], [10, 20], [0, 20]];
const uShape = polygon(...uPoints);
const diamond = polygon([10, 0], [20, 10], [10, 20], [0, 10]);

describe("area", () => {
  it("rect is width × height", () => {
    expect(area(rect(5, 5, 20, 10))).toBe(200);
  });

  it("rounded corners remove (4 − π) r²", () => {
    expect(area(rect(0, 0, 20, 10, 2))).toBeCloseTo(200 - (4 - Math.PI) * 4);
  });

  it("rx is clamped to half of the shorter side, as SVG does", () => {
    // A 10 × 10 square with a huge rx renders as a circle of r = 5
    expect(area(rect(0, 0, 10, 10, 50))).toBeCloseTo(Math.PI * 25);
  });

  it("reception is 28 m² at 32 px per meter", () => {
    expect(Math.round(area(rect(88, 98, 214, 134, 4)) / 32 ** 2)).toBe(28);
  });

  it("circle is π r²", () => {
    expect(area(circle(0, 0, 3))).toBeCloseTo(Math.PI * 9);
  });

  it("polygon uses the shoelace formula", () => {
    expect(area(polygon([0, 0], [4, 0], [4, 3]))).toBe(6);
    expect(area(lShape)).toBe(300);
    expect(area(uShape)).toBe(500);
  });

  it("polygon area does not depend on point order", () => {
    const reversed = polygon(...lPoints.toReversed());
    expect(area(reversed)).toBe(300);
  });
});

describe("bounds", () => {
  it("rect is itself", () => {
    expect(bounds(rect(5, 6, 7, 8, 2))).toEqual({ x: 5, y: 6, width: 7, height: 8 });
  });

  it("circle is the enclosing square", () => {
    expect(bounds(circle(10, 20, 5))).toEqual({ x: 5, y: 15, width: 10, height: 10 });
  });

  it("polygon spans its points", () => {
    expect(bounds(polygon([3, 7], [12, 1], [8, 9]))).toEqual({ x: 3, y: 1, width: 9, height: 8 });
  });
});

describe("center", () => {
  it("rect and circle use their geometric center", () => {
    expect(center(rect(10, 20, 40, 60))).toEqual([30, 50]);
    expect(center(circle(7, 8, 3))).toEqual([7, 8]);
  });

  it("symmetric polygon centers in the middle", () => {
    const [x, y] = center(diamond);
    expect(x).toBeCloseTo(10);
    expect(y).toBeCloseTo(10);
  });

  it("L-shape uses the area centroid", () => {
    // Bar: 200 at (10, 5); leg: 100 at (5, 15) → (2500 / 300, 2500 / 300)
    const [x, y] = center(lShape);
    expect(x).toBeCloseTo(25 / 3);
    expect(y).toBeCloseTo(25 / 3);
  });

  it("degenerate polygon falls back to the bounds center", () => {
    expect(center(polygon([0, 0], [10, 10], [20, 20]))).toEqual([10, 10]);
  });
});

describe("scanlineIntervals", () => {
  it("rect gives its full width inside and nothing outside", () => {
    const r = rect(10, 10, 30, 20);
    expect(scanlineIntervals(r, 20)).toEqual([[10, 40]]);
    expect(scanlineIntervals(r, 5)).toEqual([]);
    expect(scanlineIntervals(r, 31)).toEqual([]);
  });

  it("rounded rect is inset near the top and bottom", () => {
    const r = rect(0, 0, 40, 20, 4);
    expect(scanlineIntervals(r, 10)).toEqual([[0, 40]]);
    // 1 unit below the top: the corner arc is 3 units from its center
    const inset = 4 - Math.sqrt(16 - 9);
    const [[from, to]] = scanlineIntervals(r, 1);
    expect(from).toBeCloseTo(inset);
    expect(to).toBeCloseTo(40 - inset);
    expect(scanlineIntervals(r, 19)).toEqual(scanlineIntervals(r, 1));
  });

  it("circle is a chord, full diameter through the center", () => {
    const c = circle(50, 50, 10);
    expect(scanlineIntervals(c, 50)).toEqual([[40, 60]]);
    const [[from, to]] = scanlineIntervals(c, 56);
    expect(from).toBeCloseTo(42);
    expect(to).toBeCloseTo(58);
    expect(scanlineIntervals(c, 61)).toEqual([]);
  });

  it("L-shape gives one run in each part", () => {
    expect(scanlineIntervals(lShape, 5)).toEqual([[0, 20]]);
    expect(scanlineIntervals(lShape, 15)).toEqual([[0, 10]]);
    expect(scanlineIntervals(lShape, 25)).toEqual([]);
  });

  it("concave polygon gives several runs on one line", () => {
    expect(scanlineIntervals(uShape, 5)).toEqual([[0, 30]]);
    expect(scanlineIntervals(uShape, 15)).toEqual([
      [0, 10],
      [20, 30],
    ]);
  });

  it("a line through a vertex counts it once", () => {
    expect(scanlineIntervals(diamond, 10)).toEqual([[0, 20]]);
    expect(scanlineIntervals(diamond, 5)).toEqual([[5, 15]]);
    expect(scanlineIntervals(diamond, 0)).toEqual([]);
  });

  it("does not depend on polygon point order", () => {
    const reversed = polygon(...uPoints.toReversed());
    expect(scanlineIntervals(reversed, 15)).toEqual(scanlineIntervals(uShape, 15));
  });
});

describe("padShape", () => {
  it("rect grows on every side and keeps corners concentric", () => {
    expect(padShape(rect(88, 98, 214, 134, 4), 20)).toEqual({
      shape: rect(68, 78, 254, 174, 24),
      strokeWidth: 0,
    });
  });

  it("circle grows its radius", () => {
    expect(padShape(circle(588, 385, 68), 20)).toEqual({
      shape: circle(588, 385, 88),
      strokeWidth: 0,
    });
  });

  it("polygon keeps its points and gets a stroke 2 × padding wide", () => {
    const { shape, strokeWidth } = padShape(lShape, 20);
    expect(shape).toEqual(lShape);
    expect(strokeWidth).toBe(40);
  });

  it("zero padding leaves the shape as it is", () => {
    expect(padShape(circle(588, 385, 68), 0)).toEqual({ shape: circle(588, 385, 68), strokeWidth: 0 });
    expect(padShape(lShape, 0).strokeWidth).toBe(0);
  });

  it("does not mutate the input", () => {
    const r = rect(0, 0, 10, 10, 2);
    padShape(r, 5);
    expect(r).toEqual(rect(0, 0, 10, 10, 2));
  });
});
