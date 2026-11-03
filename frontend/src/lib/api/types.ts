import type { components } from "./schema";

// The API's bodies and answers, generated from backend/openapi.json
// (npm run api:types)
type Schemas = components["schemas"];

export type PlanResponse = Schemas["PlanResponse"];
export type ZoneResponse = Schemas["ZoneResponse"];
// A plan's own fields: its answer without the zones
export type PlanFields = Omit<PlanResponse, "zones">;
export type PlanSummary = Schemas["PlanSummaryResponse"];
export type CreatePlanBody = Schemas["CreatePlanDto"];
export type UpdatePlanBody = Schemas["UpdatePlanDto"];
export type CreateZoneBody = Schemas["CreateZoneDto"];
export type UpdateZoneBody = Schemas["UpdateZoneDto"];

// A change as the editor makes it. The version is added when the request
// is sent, from the plan the server last confirmed.
export type PlanChanges = Omit<UpdatePlanBody, "version">;
export type ZoneChanges = Omit<UpdateZoneBody, "version">;
