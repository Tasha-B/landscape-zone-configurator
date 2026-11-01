import { describe, expect, it } from "vitest";
import type { FloorPlan, Shape } from "../plan/types";
import { dragHandle, handlesOf, MIN_RADIUS, MIN_RECT_SIZE, moveShape, sameShape } from "./geometry";

const sheet: FloorPlan["viewBox"] = [0, 0, 800, 600];
const rect: Shape = { kind: "rect", x: 100, y: 100, width: 200, height: 100, rx: 4 };
const circle: Shape = { kind: "circle", cx: 400, cy: 300, r: 50 };
const polygon: Shape = {
  kind: "polygon",
  points: [
    [10, 10],
    [60, 10],
    [60, 40],
  ],
};

describe("handlesOf", () => {
  it("gives a rect its corners and edge middles", () => {
    expect(handlesOf(rect).map(({ handle, x, y }) => `${handle} ${x},${y}`)).toEqual([
      "nw 100,100",
      "n 200,100",
      "ne 300,100",
      "e 300,150",
      "se 300,200",
      "s 200,200",
      "sw 100,200",
      "w 100,150",
    ]);
  });

  it("gives a circle one handle on its right edge and a polygon one per vertex", () => {
    expect(handlesOf(circle)).toEqual([{ handle: "radius", x: 450, y: 300 }]);
    expect(handlesOf(polygon).map(({ handle }) => handle)).toEqual([0, 1, 2]);
  });
});

describe("moveShape", () => {
  it("moves each kind of shape and rounds to whole units", () => {
    expect(moveShape(rect, 10.4, -20.6, sheet)).toEqual({ ...rect, x: 110, y: 79 });
    expect(moveShape(circle, -0.5, 0.5, sheet)).toEqual({ ...circle, cx: 400, cy: 301 });
    expect(moveShape(polygon, 5, 5, sheet)).toEqual({
      kind: "polygon",
      points: [
        [15, 15],
        [65, 15],
        [65, 45],
      ],
    });
  });

  it("stops at the edges of the sheet", () => {
    expect(moveShape(rect, -500, -500, sheet)).toMatchObject({ x: 0, y: 0 });
    expect(moveShape(rect, 1000, 1000, sheet)).toMatchObject({ x: 600, y: 500 });
    expect(moveShape(circle, 1000, -1000, sheet)).toMatchObject({ cx: 750, cy: 50 });
  });

  it("respects a viewBox that does not start at 0 0", () => {
    expect(moveShape(rect, -500, -500, [50, 60, 800, 600])).toMatchObject({ x: 50, y: 60 });
  });
});

describe("dragHandle on a rect", () => {
  it("moves only the dragged edges", () => {
    expect(dragHandle(rect, "se", [350.4, 260], sheet)).toEqual({ ...rect, width: 250, height: 160 });
    expect(dragHandle(rect, "nw", [80, 90], sheet)).toEqual({ ...rect, x: 80, y: 90, width: 220, height: 110 });
    expect(dragHandle(rect, "n", [999, 50], sheet)).toEqual({ ...rect, y: 50, height: 150 });
    expect(dragHandle(rect, "w", [150, 999], sheet)).toEqual({ ...rect, x: 150, width: 150 });
  });

  it("flips when dragged past the opposite edge", () => {
    expect(dragHandle(rect, "e", [40, 150], sheet)).toEqual({ ...rect, x: 40, width: 60 });
    expect(dragHandle(rect, "s", [200, 20], sheet)).toEqual({ ...rect, y: 20, height: 80 });
  });

  it("keeps the minimum size without moving the fixed edge", () => {
    expect(dragHandle(rect, "e", [103, 150], sheet)).toEqual({ ...rect, width: MIN_RECT_SIZE });
    expect(dragHandle(rect, "w", [298, 150], sheet)).toEqual({ ...rect, x: 300 - MIN_RECT_SIZE, width: MIN_RECT_SIZE });
    // No room on the dragged side: the edge goes to the other side
    const atRight: Shape = { ...rect, x: 600, width: 200 };
    expect(dragHandle(atRight, "w", [797, 150], sheet)).toEqual({ ...atRight, x: 790, width: MIN_RECT_SIZE });
  });

  it("keeps the dragged edges on the sheet", () => {
    expect(dragHandle(rect, "se", [5000, 5000], sheet)).toEqual({ ...rect, width: 700, height: 500 });
    expect(dragHandle(rect, "nw", [-50, -50], sheet)).toEqual({ ...rect, x: 0, y: 0, width: 300, height: 200 });
  });

  it("ignores a handle of another kind", () => {
    expect(dragHandle(rect, "radius", [1, 1], sheet)).toBe(rect);
    expect(dragHandle(rect, 0, [1, 1], sheet)).toBe(rect);
  });
});

describe("dragHandle on a circle", () => {
  it("sets the radius to the distance from the center", () => {
    expect(dragHandle(circle, "radius", [400, 380], sheet)).toEqual({ ...circle, r: 80 });
    expect(dragHandle(circle, "radius", [430, 340], sheet)).toEqual({ ...circle, r: 50 });
  });

  it("keeps the minimum radius and the circle on the sheet", () => {
    expect(dragHandle(circle, "radius", [401, 300], sheet)).toEqual({ ...circle, r: MIN_RADIUS });
    expect(dragHandle(circle, "radius", [400, 5000], sheet)).toEqual({ ...circle, r: 300 });
    const nearEdge: Shape = { kind: "circle", cx: 20, cy: 300, r: 10 };
    expect(dragHandle(nearEdge, "radius", [200, 300], sheet)).toEqual({ ...nearEdge, r: 20 });
  });
});

describe("dragHandle on a polygon", () => {
  it("moves one vertex, rounded and on the sheet", () => {
    expect(dragHandle(polygon, 1, [70.6, 5.2], sheet)).toEqual({
      kind: "polygon",
      points: [
        [10, 10],
        [71, 5],
        [60, 40],
      ],
    });
    expect(dragHandle(polygon, 2, [900, -10], sheet)).toMatchObject({ points: [[10, 10], [60, 10], [800, 0]] });
  });

  it("ignores a vertex that does not exist", () => {
    expect(dragHandle(polygon, 7, [1, 1], sheet)).toBe(polygon);
  });
});

describe("sameShape", () => {
  it("compares by value", () => {
    expect(sameShape(rect, { ...rect })).toBe(true);
    expect(sameShape(rect, { ...rect, x: 101 })).toBe(false);
  });
});
