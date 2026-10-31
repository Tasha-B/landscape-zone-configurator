import { useQuery } from "@tanstack/react-query";
import type { FloorPlan, Zone } from "../plan/types";
import type { components } from "./schema";

// Generated from backend/openapi.json (npm run api:types)
type PlanResponse = components["schemas"]["PlanResponse"];
type ZoneResponse = components["schemas"]["ZoneResponse"];

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

// The API's plan in the frontend's model. Every field is named on both
// sides, so a field the API renames or drops breaks the build here. The API
// sends null where the model leaves a field out.
export function toFloorPlan(plan: PlanResponse): FloorPlan {
  return {
    id: plan.id,
    name: plan.name,
    viewBox: plan.viewBox,
    pxPerMeter: plan.pxPerMeter,
    ...(plan.background !== null && { background: plan.background }),
    zones: plan.zones.map(toZone),
  };
}

// `version` is left out until the editor sends it back (phase 6)
function toZone(zone: ZoneResponse): Zone {
  return {
    id: zone.id,
    type: zone.type,
    shape: zone.shape,
    color: zone.color,
    zIndex: zone.zIndex,
    ...(zone.hitPadding !== null && { hitPadding: zone.hitPadding }),
    ...(zone.label !== null && { label: zone.label }),
    content: zone.content,
  };
}

export async function fetchPlan(id: string, signal?: AbortSignal): Promise<FloorPlan> {
  const response = await fetch(`/api/plans/${encodeURIComponent(id)}`, { signal });
  if (!response.ok) {
    throw new ApiError(response.status, `GET /api/plans/${id} answered ${response.status}`);
  }
  return toFloorPlan((await response.json()) as PlanResponse);
}

// The plan through the query cache: one request however many components
// ask, cancelled when nobody needs it any more
export function usePlan(id: string) {
  return useQuery({ queryKey: ["plan", id], queryFn: ({ signal }) => fetchPlan(id, signal) });
}
