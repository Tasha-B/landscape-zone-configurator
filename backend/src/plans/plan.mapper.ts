import type { FloorPlan } from "../generated/prisma/client.js";
import { toZoneResponse, type ZoneRow } from "../zones/zone.mapper.js";
import type { PlanResponse } from "./plan.response.js";

export type PlanRow = FloorPlan & { zones: ZoneRow[] };

// Turns a plan read with its zones (already in legend order) and their
// content into the API response
export function toPlanResponse(plan: PlanRow): PlanResponse {
  return {
    id: plan.id,
    name: plan.name,
    // Always four numbers: a CHECK constraint in the init migration
    viewBox: plan.viewBox as PlanResponse["viewBox"],
    pxPerMeter: plan.pxPerMeter,
    background: plan.background,
    version: plan.version,
    zones: plan.zones.map(toZoneResponse),
  };
}
