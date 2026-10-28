import type { Lang } from "../i18n/translations";

// Coordinates are in SVG user units of the plan's viewBox
export type Point = [number, number];

export type Shape =
  | { kind: "rect"; x: number; y: number; width: number; height: number; rx: number }
  | { kind: "circle"; cx: number; cy: number; r: number }
  | { kind: "polygon"; points: Point[] }; // curves approximated by points

export type ZoneType =
  | "reception"
  | "meeting-room"
  | "open-floor"
  | "break-room"
  | "signature-corner"
  | "custom";

export interface ZoneContent {
  name: string;
  tagline: string;
  recommendation: string;
  rationale: string;
}

export interface Zone {
  id: string; // uuid once it comes from the DB
  type: ZoneType;
  shape: Shape;
  color: string; // marker, hover tint and legend swatch
  zIndex: number; // paint and tab order
  hitPadding?: number; // default 20; signature corner uses 0
  // Name position as an offset from the shape center; the area caption sits
  // areaDy below it (default 22)
  label?: { dx: number; dy: number; fontSize?: number; areaDy?: number };
  content: Record<Lang, ZoneContent>;
}

export interface FloorPlan {
  id: string;
  name: string;
  viewBox: [number, number, number, number];
  pxPerMeter: number;
  zones: Zone[]; // array order = legend order
}
