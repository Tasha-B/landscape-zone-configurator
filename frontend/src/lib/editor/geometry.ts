import { bounds } from "../plan/geometry";
import type { FloorPlan, Point, Shape } from "../plan/types";

// The editor's changes to a shape. Every function keeps the shape on the
// sheet (inside the viewBox) and rounds its coordinates to whole units, so
// saved shapes stay readable.

type ViewBox = FloorPlan["viewBox"];

export const MIN_RECT_SIZE = 10;
export const MIN_RADIUS = 5;

// A rect's eight handles, by compass direction; a circle's one handle on
// its edge; a polygon's handle per vertex
export type RectHandle = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";
export type Handle = RectHandle | "radius" | number;

export interface HandlePosition {
  handle: Handle;
  x: number;
  y: number;
}

export function handlesOf(shape: Shape): HandlePosition[] {
  switch (shape.kind) {
    case "rect": {
      const { x, y, width: w, height: h } = shape;
      const at = (handle: RectHandle, hx: number, hy: number) => ({ handle, x: hx, y: hy });
      return [
        at("nw", x, y),
        at("n", x + w / 2, y),
        at("ne", x + w, y),
        at("e", x + w, y + h / 2),
        at("se", x + w, y + h),
        at("s", x + w / 2, y + h),
        at("sw", x, y + h),
        at("w", x, y + h / 2),
      ];
    }
    case "circle":
      return [{ handle: "radius", x: shape.cx + shape.r, y: shape.cy }];
    case "polygon":
      return shape.points.map(([x, y], index) => ({ handle: index, x, y }));
  }
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

function clampPoint([x, y]: Point, [minX, minY, width, height]: ViewBox): Point {
  return [Math.round(clamp(x, minX, minX + width)), Math.round(clamp(y, minY, minY + height))];
}

// Moves the shape by (dx, dy), as far as the sheet allows in each direction
export function moveShape(shape: Shape, dx: number, dy: number, viewBox: ViewBox): Shape {
  const [minX, minY, width, height] = viewBox;
  const b = bounds(shape);
  // A shape larger than the sheet cannot be kept on it; it stays where it is
  const x = clamp(dx, minX - b.x, Math.max(minX - b.x, minX + width - (b.x + b.width)));
  const y = clamp(dy, minY - b.y, Math.max(minY - b.y, minY + height - (b.y + b.height)));
  return roundShape(translate(shape, x, y));
}

function translate(shape: Shape, dx: number, dy: number): Shape {
  switch (shape.kind) {
    case "rect":
      return { ...shape, x: shape.x + dx, y: shape.y + dy };
    case "circle":
      return { ...shape, cx: shape.cx + dx, cy: shape.cy + dy };
    case "polygon":
      return { ...shape, points: shape.points.map(([x, y]) => [x + dx, y + dy]) };
  }
}

function roundShape(shape: Shape): Shape {
  switch (shape.kind) {
    case "rect":
      return { ...shape, x: Math.round(shape.x), y: Math.round(shape.y) };
    case "circle":
      return { ...shape, cx: Math.round(shape.cx), cy: Math.round(shape.cy) };
    case "polygon":
      return { ...shape, points: shape.points.map(([x, y]) => [Math.round(x), Math.round(y)]) };
  }
}

// The shape with one handle dragged to `point` (in viewBox units). `shape`
// is the shape as it was when the drag started, so the result depends only
// on where the pointer is now.
export function dragHandle(shape: Shape, handle: Handle, point: Point, viewBox: ViewBox): Shape {
  switch (shape.kind) {
    case "rect":
      return typeof handle === "string" && handle !== "radius" ? dragRectHandle(shape, handle, point, viewBox) : shape;
    case "circle":
      return handle === "radius" ? dragRadius(shape, point, viewBox) : shape;
    case "polygon": {
      if (typeof handle !== "number" || !shape.points[handle]) return shape;
      const points = shape.points.map((vertex, index) => (index === handle ? clampPoint(point, viewBox) : vertex));
      return { ...shape, points };
    }
  }
}

// The dragged edges follow the pointer, the others stay. Dragged past the
// opposite edge, the rect flips instead of turning negative; it keeps at
// least MIN_RECT_SIZE, growing away from the fixed edge.
function dragRectHandle(
  shape: Extract<Shape, { kind: "rect" }>,
  handle: RectHandle,
  point: Point,
  viewBox: ViewBox,
): Shape {
  const [px, py] = clampPoint(point, viewBox);
  const [minX, minY, width, height] = viewBox;
  const left = shape.x;
  const top = shape.y;
  const right = shape.x + shape.width;
  const bottom = shape.y + shape.height;

  const horizontal = handle.includes("w")
    ? edges(px, right, minX, minX + width)
    : handle.includes("e")
      ? edges(px, left, minX, minX + width)
      : [left, right];
  const vertical = handle.includes("n")
    ? edges(py, bottom, minY, minY + height)
    : handle.includes("s")
      ? edges(py, top, minY, minY + height)
      : [top, bottom];
  return {
    ...shape,
    x: horizontal[0],
    y: vertical[0],
    width: horizontal[1] - horizontal[0],
    height: vertical[1] - vertical[0],
  };
}

// The dragged edge and the fixed one → [low, high]. The fixed edge never
// moves: closer than MIN_RECT_SIZE, the dragged edge is put MIN_RECT_SIZE
// away on its own side, or on the other side if the sheet ends there.
function edges(moving: number, fixed: number, sheetMin: number, sheetMax: number): [number, number] {
  let edge = Math.round(moving);
  if (Math.abs(edge - fixed) < MIN_RECT_SIZE) {
    const side = edge >= fixed ? 1 : -1;
    edge = fixed + side * MIN_RECT_SIZE;
    if (edge > sheetMax || edge < sheetMin) edge = fixed - side * MIN_RECT_SIZE;
  }
  return [Math.min(edge, fixed), Math.max(edge, fixed)];
}

// The radius is the distance from the center to the pointer, at least
// MIN_RADIUS and no more than keeps the circle on the sheet
function dragRadius(shape: Extract<Shape, { kind: "circle" }>, [px, py]: Point, viewBox: ViewBox): Shape {
  const [minX, minY, width, height] = viewBox;
  const room = Math.min(shape.cx - minX, minX + width - shape.cx, shape.cy - minY, minY + height - shape.cy);
  const r = Math.round(Math.hypot(px - shape.cx, py - shape.cy));
  return { ...shape, r: clamp(r, MIN_RADIUS, Math.max(MIN_RADIUS, Math.floor(room))) };
}

// A polygon's edge middles: dragging one inserts a vertex there
export interface Midpoint {
  edge: number; // the edge from vertex `edge` to the next one
  x: number;
  y: number;
}

export function midpointsOf(shape: Shape): Midpoint[] {
  if (shape.kind !== "polygon") return [];
  const { points } = shape;
  return points.map(([x1, y1], edge) => {
    const [x2, y2] = points[(edge + 1) % points.length];
    return { edge, x: (x1 + x2) / 2, y: (y1 + y2) / 2 };
  });
}

// The polygon with a new vertex at `point` on edge `edge`, which becomes
// vertex edge + 1
export function insertVertex(shape: Shape, edge: number, point: Point, viewBox: ViewBox): Shape {
  if (shape.kind !== "polygon" || !shape.points[edge]) return shape;
  const points = [...shape.points];
  points.splice(edge + 1, 0, clampPoint(point, viewBox));
  return { ...shape, points };
}

export const MIN_POLYGON_POINTS = 3;

// The polygon without vertex `index`; a triangle keeps its three
export function removeVertex(shape: Shape, index: number): Shape {
  if (shape.kind !== "polygon" || !shape.points[index] || shape.points.length <= MIN_POLYGON_POINTS) return shape;
  return { ...shape, points: shape.points.filter((_, i) => i !== index) };
}

// A double arrow pointing away from the shape's center, as on a rect's
// corners: the direction a vertex or handle there is usually dragged in
export function resizeCursor(from: Point, to: Point): string {
  const angle = (Math.atan2(to[1] - from[1], to[0] - from[0]) * 180) / Math.PI; // y grows downwards
  const sector = Math.round(angle / 45); // -4 … 4: east is 0, south is 2
  switch (((sector % 4) + 4) % 4) {
    case 0:
      return "ew-resize";
    case 1:
      return "nwse-resize";
    case 2:
      return "ns-resize";
    default:
      return "nesw-resize";
  }
}

export function sameShape(a: Shape, b: Shape): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
