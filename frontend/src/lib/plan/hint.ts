import type { FloorPlan } from "./types";

// The zone whose marker plays the one-shot hint: the first in legend order,
// which every plan with zones has (reception in the demo office). The "tap a
// zone" note points at the plan as a whole, not at this zone.
export function hintZoneId(plan: FloorPlan): string | undefined {
  return plan.zones[0]?.id;
}
