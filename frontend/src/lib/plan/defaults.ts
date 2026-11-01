import type { FloorPlan } from "./types";

// A new plan: a sheet the size of the demo office's, at its scale, with a
// blank background. The editor can change all three.
export const NEW_PLAN: Pick<FloorPlan, "viewBox" | "pxPerMeter"> = {
  viewBox: [0, 0, 800, 600],
  pxPerMeter: 32,
};
