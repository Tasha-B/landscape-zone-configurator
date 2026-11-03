import type { PlanFields, ZoneResponse } from "./types";

// The socket's protocol (backend/src/realtime/plan-events.gateway.ts). OpenAPI
// does not describe it, but the bodies are the REST answers, so their types
// are the generated ones.

export interface PlanServerEvents {
  "zone.created": (body: { planId: string; zone: ZoneResponse }) => void;
  "zone.updated": (body: { planId: string; zone: ZoneResponse }) => void;
  "zone.deleted": (body: { planId: string; zoneId: string }) => void;
  "plan.updated": (body: { planId: string; plan: PlanFields }) => void;
  "plan.deleted": (body: { planId: string }) => void;
}

export interface PlanClientEvents {
  join: (body: { planId: string }, ack: (answer: { ok: boolean }) => void) => void;
}
