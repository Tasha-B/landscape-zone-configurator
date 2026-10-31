import { describe, expect, it } from "vitest";
import { anchorTransform, type Anchor } from "./anchor";
import type { FloorPlan } from "./types";

const ANCHORS: Anchor[] = [
  { x: "left", y: "top" },
  { x: "center", y: "top" },
  { x: "right", y: "top" },
  { x: "left", y: "bottom" },
];

describe("anchorTransform", () => {
  it("leaves the notes where they were drawn on the demo office's sheet", () => {
    for (const anchor of ANCHORS) {
      expect(anchorTransform([0, 0, 800, 600], anchor)).toBe("translate(0 0)");
    }
  });

  it("keeps each note's distance to its edge on a larger sheet", () => {
    const viewBox: FloorPlan["viewBox"] = [0, 0, 1000, 700];
    expect(anchorTransform(viewBox, { x: "left", y: "top" })).toBe("translate(0 0)");
    expect(anchorTransform(viewBox, { x: "center", y: "top" })).toBe("translate(100 0)");
    expect(anchorTransform(viewBox, { x: "right", y: "top" })).toBe("translate(200 0)");
    expect(anchorTransform(viewBox, { x: "left", y: "bottom" })).toBe("translate(0 100)");
  });

  it("moves the notes in with a smaller sheet", () => {
    expect(anchorTransform([0, 0, 400, 300], { x: "right", y: "top" })).toBe("translate(-400 0)");
    expect(anchorTransform([0, 0, 400, 300], { x: "left", y: "bottom" })).toBe("translate(0 -300)");
  });

  it("follows a viewBox that does not start at 0 0", () => {
    expect(anchorTransform([-50, 20, 800, 600], { x: "right", y: "bottom" })).toBe("translate(-50 20)");
    expect(anchorTransform([-50, 20, 900, 600], { x: "center", y: "top" })).toBe("translate(0 20)");
  });
});
