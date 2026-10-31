import type { FloorPlan } from "./types";

// The notes around the plan (tap hint, compass, palette, sheet title) were
// drawn on the demo office's 800 × 600 sheet. On a sheet of another size
// each group keeps its distance to one edge of the viewBox: the drawn
// coordinates are moved by a translation, which is translate(0 0) on the
// demo office.
export const DRAWN_SHEET = { width: 800, height: 600 };

export interface Anchor {
  x: "left" | "center" | "right";
  y: "top" | "bottom";
}

export function anchorTransform([minX, minY, width, height]: FloorPlan["viewBox"], anchor: Anchor): string {
  const extraWidth = width - DRAWN_SHEET.width;
  const dx = minX + (anchor.x === "left" ? 0 : anchor.x === "center" ? extraWidth / 2 : extraWidth);
  const dy = minY + (anchor.y === "top" ? 0 : height - DRAWN_SHEET.height);
  return `translate(${dx} ${dy})`;
}
