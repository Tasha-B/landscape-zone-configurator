import type { FloorPlan, Point } from "../plan/types";

// A pointer position on the page → viewBox units. The editor's SVG is as
// wide as its box and as tall as the viewBox's aspect makes it, and it is
// not rotated, so its box maps linearly onto the viewBox.
export function toPlanPoint(
  clientX: number,
  clientY: number,
  box: { left: number; top: number; width: number; height: number },
  [minX, minY, width, height]: FloorPlan["viewBox"],
): Point {
  return [minX + ((clientX - box.left) * width) / box.width, minY + ((clientY - box.top) * height) / box.height];
}
