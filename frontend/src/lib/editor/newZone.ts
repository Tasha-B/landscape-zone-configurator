import type { CreateZoneBody, ZoneResponse } from "../api/types";
import type { FloorPlan, Shape } from "../plan/types";

// What "+ Rect", "+ Circle" and "+ Polygon" add: a custom zone in the
// middle of the sheet, in the next free color, with draft texts in both
// languages that the properties panel then replaces

export type NewShapeKind = Shape["kind"];

// The demo office's five colors, then three more in the same earthy range
export const ZONE_PALETTE = [
  "#C9962A",
  "#7A9A5B",
  "#5FA88C",
  "#C4703C",
  "#4F7CAC",
  "#9B6FA8",
  "#B85C5C",
  "#6B7F3A",
] as const;

// The API needs every text in both languages, whatever language the page is in
export const DRAFT_CONTENT: CreateZoneBody["content"] = {
  en: {
    name: "New zone",
    tagline: "A short line about the zone",
    recommendation: "What we would plant here",
    rationale: "Why it suits the zone",
  },
  ru: {
    name: "Новая зона",
    tagline: "Короткая строка о зоне",
    recommendation: "Что мы бы здесь посадили",
    rationale: "Почему это подходит зоне",
  },
};

// Each new zone lands a little lower and to the right of the last one, so
// zones added one after another do not hide each other
const STAGGER_STEPS = 5;

export function newZoneBody(kind: NewShapeKind, viewBox: FloorPlan["viewBox"], zones: ZoneResponse[]): CreateZoneBody {
  const [minX, minY, width, height] = viewBox;
  const offset = (zones.length % STAGGER_STEPS) * Math.round(Math.min(width, height) / 12);
  const cx = Math.round(minX + width / 2) + offset;
  const cy = Math.round(minY + height / 2) + offset;
  return { type: "custom", shape: newShape(kind, cx, cy, width, height), color: nextColor(zones), content: DRAFT_CONTENT };
}

function newShape(kind: NewShapeKind, cx: number, cy: number, width: number, height: number): Shape {
  switch (kind) {
    case "rect": {
      const w = Math.round(width / 4);
      const h = Math.round(height / 5);
      return { kind: "rect", x: cx - Math.round(w / 2), y: cy - Math.round(h / 2), width: w, height: h, rx: 4 };
    }
    case "circle":
      return { kind: "circle", cx, cy, r: Math.round(Math.min(width, height) / 8) };
    case "polygon": {
      // An L: the full top half, then the right half down to the bottom.
      // Its six vertices can be dragged into a rectangle with a notch, a
      // trapezoid or a slanted corner.
      const w = Math.round(width / 4);
      const h = Math.round(height / 4);
      const x = cx - Math.round(w / 2);
      const y = cy - Math.round(h / 2);
      const midX = x + Math.round(w / 2);
      const midY = y + Math.round(h / 2);
      return {
        kind: "polygon",
        points: [
          [x, y],
          [x + w, y],
          [x + w, y + h],
          [midX, y + h],
          [midX, midY],
          [x, midY],
        ],
      };
    }
  }
}

// The first palette color no zone uses; once all are taken, round they go
export function nextColor(zones: ZoneResponse[]): string {
  const used = new Set(zones.map((zone) => zone.color.toUpperCase()));
  return ZONE_PALETTE.find((color) => !used.has(color)) ?? ZONE_PALETTE[zones.length % ZONE_PALETTE.length];
}
