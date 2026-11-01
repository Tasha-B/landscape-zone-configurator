import { describe, expect, it } from "vitest";
import type { ZoneResponse } from "../api/types";
import { area, bounds } from "../plan/geometry";
import { DRAFT_CONTENT, newZoneBody, nextColor, ZONE_PALETTE } from "./newZone";

const zone = (color: string) => ({ color }) as ZoneResponse;

describe("newZoneBody", () => {
  it("puts each kind in the middle of the sheet, sized to it", () => {
    expect(newZoneBody("rect", [0, 0, 800, 600], []).shape).toEqual({
      kind: "rect",
      x: 300,
      y: 240,
      width: 200,
      height: 120,
      rx: 4,
    });
    expect(newZoneBody("circle", [0, 0, 800, 600], []).shape).toEqual({ kind: "circle", cx: 400, cy: 300, r: 75 });
    expect(newZoneBody("rect", [100, 50, 1600, 1200], []).shape).toMatchObject({ x: 700, y: 530, width: 400, height: 240 });
  });

  it("makes a polygon an L of six points around the middle", () => {
    const shape = newZoneBody("polygon", [0, 0, 800, 600], []).shape;
    expect(shape).toEqual({
      kind: "polygon",
      points: [
        [300, 225],
        [500, 225],
        [500, 375],
        [400, 375],
        [400, 300],
        [300, 300],
      ],
    });
    // Three quarters of its bounding box: an L, not a rectangle
    const box = bounds(shape);
    expect(area(shape)).toBe(box.width * box.height * 0.75);
  });

  it("moves each further zone a little, back to the middle every fifth one", () => {
    const sheet = [0, 0, 800, 600] as const;
    const centerX = (count: number) => {
      const shape = newZoneBody("circle", [...sheet], Array.from({ length: count }, () => zone("#000000"))).shape;
      return shape.kind === "circle" ? shape.cx : NaN;
    };
    expect([0, 1, 2, 5].map(centerX)).toEqual([400, 450, 500, 400]);
  });

  it("is a custom zone with draft texts in both languages", () => {
    expect(newZoneBody("rect", [0, 0, 800, 600], [])).toMatchObject({ type: "custom", content: DRAFT_CONTENT });
    for (const lang of ["en", "ru"] as const) {
      expect(Object.values(DRAFT_CONTENT[lang]).every((text) => text.trim().length > 0)).toBe(true);
    }
  });
});

describe("nextColor", () => {
  it("takes the first palette color no zone uses, in any letter case", () => {
    expect(nextColor([])).toBe("#C9962A");
    expect(nextColor([zone("#c9962a"), zone("#5FA88C")])).toBe("#7A9A5B");
  });

  it("goes round the palette once every color is used", () => {
    const all = ZONE_PALETTE.map(zone);
    expect(nextColor(all)).toBe(ZONE_PALETTE[0]);
    expect(nextColor([...all, zone("#000000")])).toBe(ZONE_PALETTE[1]);
  });
});
