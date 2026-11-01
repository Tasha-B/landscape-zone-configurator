import { describe, expect, it } from "vitest";
import { toPlanPoint } from "./pointer";

describe("toPlanPoint", () => {
  it("maps the SVG's box on the page onto the viewBox", () => {
    const box = { left: 100, top: 50, width: 400, height: 300 };
    expect(toPlanPoint(100, 50, box, [0, 0, 800, 600])).toEqual([0, 0]);
    expect(toPlanPoint(500, 350, box, [0, 0, 800, 600])).toEqual([800, 600]);
    expect(toPlanPoint(300, 200, box, [-100, 20, 800, 600])).toEqual([300, 320]);
  });

  it("maps every point to the corner when the SVG has no size, never to NaN", () => {
    const empty = { left: 0, top: 0, width: 0, height: 0 };
    expect(toPlanPoint(10, 20, empty, [5, 6, 800, 600])).toEqual([5, 6]);
    expect(toPlanPoint(300, 400, empty, [5, 6, 800, 600])).toEqual([5, 6]);
  });
});
