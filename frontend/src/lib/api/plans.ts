import { useQuery } from "@tanstack/react-query";
import type { FloorPlan, Zone } from "../plan/types";
import { request } from "./client";
import type {
  CreatePlanBody,
  CreateZoneBody,
  PlanResponse,
  PlanSummary,
  UpdatePlanBody,
  UpdateZoneBody,
  ZoneResponse,
} from "./types";

// The API's plan in the frontend's model. Every field is named on both
// sides, so a field the API renames or drops breaks the build here. The API
// sends null where the model leaves a field out. The versions are left
// out: only the editor needs them, and it reads the API's answer as is.
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

// The endpoints, one function each
const segment = (id: string) => encodeURIComponent(id);
export const fetchPlan = (id: string, signal?: AbortSignal) =>
  request<PlanResponse>("GET", `/plans/${segment(id)}`, { signal });
export const listPlans = (signal?: AbortSignal) => request<PlanSummary[]>("GET", "/plans", { signal });
export const createPlan = (body: CreatePlanBody) => request<PlanResponse>("POST", "/plans", { body });
export const updatePlan = (id: string, body: UpdatePlanBody) =>
  request<PlanResponse>("PATCH", `/plans/${segment(id)}`, { body });
export const deletePlan = (id: string) => request<void>("DELETE", `/plans/${segment(id)}`);
export const createZone = (planId: string, body: CreateZoneBody) =>
  request<ZoneResponse>("POST", `/plans/${segment(planId)}/zones`, { body });
export const updateZone = (id: string, body: UpdateZoneBody) =>
  request<ZoneResponse>("PATCH", `/zones/${segment(id)}`, { body });
export const deleteZone = (id: string) => request<void>("DELETE", `/zones/${segment(id)}`);

// The cache holds the API's answer, versions and nulls included, as the
// server last confirmed it. The showcase and the editor share the entry,
// so a change saved in the editor shows on the showcase.
export const planKey = (id: string) => ["plan", id] as const;
export const PLANS_KEY = ["plans"] as const;

const planQuery = (id: string) => ({
  queryKey: planKey(id),
  queryFn: ({ signal }: { signal: AbortSignal }) => fetchPlan(id, signal),
});

// The plan in the frontend's model, for the showcase. One request however
// many components ask, cancelled when nobody needs it any more.
export function usePlan(id: string) {
  return useQuery({ ...planQuery(id), select: toFloorPlan });
}

// The API's answer as the server confirmed it; the editor shows it with its
// pending changes on top (useEditedPlan in edits.ts)
export function usePlanResponse(id: string) {
  return useQuery(planQuery(id));
}

export function usePlans() {
  return useQuery({ queryKey: PLANS_KEY, queryFn: ({ signal }) => listPlans(signal) });
}
