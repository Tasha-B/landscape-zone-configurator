import type { Point, Shape } from "./types";

export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

// A horizontal run [fromX, toX] where a scanline is inside the shape
export type Interval = [number, number];

// What to render as the invisible hit target. Rects and circles grow
// geometrically; a polygon keeps its points and gets a transparent stroke
// instead, because offsetting an arbitrary (possibly concave) polygon is
// not worth it when a stroke 2 × padding wide covers the same band.
export interface HitArea {
  shape: Shape;
  strokeWidth: number;
}

// SVG clamps rx to half of the shorter side; geometry must agree with
// what is drawn
function effectiveRx(shape: Extract<Shape, { kind: "rect" }>) {
  return Math.max(0, Math.min(shape.rx, shape.width / 2, shape.height / 2));
}

function signedPolygonArea(points: Point[]) {
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[(i + 1) % points.length];
    sum += x1 * y2 - x2 * y1;
  }
  return sum / 2;
}

export function area(shape: Shape): number {
  switch (shape.kind) {
    case "rect": {
      const r = effectiveRx(shape);
      // Each rounded corner cuts a square r × r down to a quarter circle
      return shape.width * shape.height - (4 - Math.PI) * r * r;
    }
    case "circle":
      return Math.PI * shape.r * shape.r;
    case "polygon":
      return Math.abs(signedPolygonArea(shape.points)); // shoelace
  }
}

export function bounds(shape: Shape): Bounds {
  switch (shape.kind) {
    case "rect":
      return { x: shape.x, y: shape.y, width: shape.width, height: shape.height };
    case "circle":
      return {
        x: shape.cx - shape.r,
        y: shape.cy - shape.r,
        width: shape.r * 2,
        height: shape.r * 2,
      };
    case "polygon": {
      const xs = shape.points.map(([x]) => x);
      const ys = shape.points.map(([, y]) => y);
      const minX = Math.min(...xs);
      const minY = Math.min(...ys);
      return { x: minX, y: minY, width: Math.max(...xs) - minX, height: Math.max(...ys) - minY };
    }
  }
}

// Area centroid. For a concave polygon it may fall outside the shape,
// which is why zones keep a label offset.
export function center(shape: Shape): Point {
  switch (shape.kind) {
    case "rect":
      return [shape.x + shape.width / 2, shape.y + shape.height / 2];
    case "circle":
      return [shape.cx, shape.cy];
    case "polygon": {
      const a = signedPolygonArea(shape.points);
      if (a === 0) {
        const b = bounds(shape);
        return [b.x + b.width / 2, b.y + b.height / 2];
      }
      let cx = 0;
      let cy = 0;
      for (let i = 0; i < shape.points.length; i++) {
        const [x1, y1] = shape.points[i];
        const [x2, y2] = shape.points[(i + 1) % shape.points.length];
        const cross = x1 * y2 - x2 * y1;
        cx += (x1 + x2) * cross;
        cy += (y1 + y2) * cross;
      }
      return [cx / (6 * a), cy / (6 * a)];
    }
  }
}

// Inside runs of the horizontal line at `y`, left to right. A concave
// polygon can give several runs; outside the shape the list is empty.
export function scanlineIntervals(shape: Shape, y: number): Interval[] {
  switch (shape.kind) {
    case "rect": {
      const top = shape.y;
      const bottom = shape.y + shape.height;
      if (y < top || y > bottom) return [];
      const r = effectiveRx(shape);
      const fromEdge = Math.min(y - top, bottom - y);
      const inset = fromEdge < r ? r - Math.sqrt(r * r - (r - fromEdge) ** 2) : 0;
      return [[shape.x + inset, shape.x + shape.width - inset]];
    }
    case "circle": {
      const dy = y - shape.cy;
      if (Math.abs(dy) > shape.r) return [];
      const half = Math.sqrt(shape.r * shape.r - dy * dy);
      return [[shape.cx - half, shape.cx + half]];
    }
    case "polygon": {
      // Even-odd rule. Each edge covers [minY, maxY), so a line through a
      // vertex counts it once and horizontal edges are skipped.
      const xs: number[] = [];
      const { points } = shape;
      for (let i = 0; i < points.length; i++) {
        const [x1, y1] = points[i];
        const [x2, y2] = points[(i + 1) % points.length];
        if ((y1 <= y) !== (y2 <= y)) {
          xs.push(x1 + ((y - y1) * (x2 - x1)) / (y2 - y1));
        }
      }
      xs.sort((a, b) => a - b);
      const intervals: Interval[] = [];
      for (let i = 0; i + 1 < xs.length; i += 2) {
        if (xs[i + 1] > xs[i]) intervals.push([xs[i], xs[i + 1]]);
      }
      return intervals;
    }
  }
}

export function padShape(shape: Shape, padding: number): HitArea {
  switch (shape.kind) {
    case "rect":
      return {
        shape: {
          kind: "rect",
          x: shape.x - padding,
          y: shape.y - padding,
          width: shape.width + padding * 2,
          height: shape.height + padding * 2,
          rx: shape.rx + padding,
        },
        strokeWidth: 0,
      };
    case "circle":
      return { shape: { ...shape, r: shape.r + padding }, strokeWidth: 0 };
    case "polygon":
      return { shape, strokeWidth: padding * 2 };
  }
}
