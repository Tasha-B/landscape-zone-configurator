import type { Lang } from "../generated/prisma/enums.js";
import type { ZoneTypeName } from "./zone-type.js";

// The response of GET /api/plans/:id. Names and structure follow the
// frontend model (frontend/src/lib/plan/types.ts), except that fields the
// frontend leaves out are null here, so every field is always present.

export class RectShape {
  kind!: "rect";
  x!: number;
  y!: number;
  width!: number;
  height!: number;
  rx!: number;
}

export class CircleShape {
  kind!: "circle";
  cx!: number;
  cy!: number;
  r!: number;
}

export class PolygonShape {
  kind!: "polygon";
  points!: [number, number][];
}

export type Shape = RectShape | CircleShape | PolygonShape;

// Name position as an offset from the shape center
export class ZoneLabel {
  dx!: number;
  dy!: number;
  fontSize?: number;
  areaDy?: number;
}

export class ZoneContentResponse {
  name!: string;
  tagline!: string;
  recommendation!: string;
  rationale!: string;
}

export class ZoneResponse {
  id!: string;
  type!: ZoneTypeName;
  shape!: Shape;
  color!: string;
  zIndex!: number;
  hitPadding!: number | null;
  label!: ZoneLabel | null;
  version!: number;
  content!: Record<Lang, ZoneContentResponse>;
}

export class PlanResponse {
  id!: string;
  name!: string;
  viewBox!: [number, number, number, number];
  pxPerMeter!: number;
  background!: string | null;
  // Legend order
  zones!: ZoneResponse[];
}
