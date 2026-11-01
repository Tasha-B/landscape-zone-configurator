import type { CreateZoneBody, PlanChanges, PlanResponse, ZoneChanges, ZoneResponse } from "./types";

// One change the editor sends. While its request is pending, the editor
// shows it on top of the plan the server last confirmed; once the request
// settles, the cache holds the server's answer and the edit is dropped. A
// failed edit therefore disappears from the screen by itself.
export type PlanEdit =
  | { kind: "updatePlan"; changes: PlanChanges }
  | { kind: "createZone"; body: CreateZoneBody }
  | { kind: "updateZone"; zoneId: string; changes: ZoneChanges }
  | { kind: "deleteZone"; zoneId: string };

// The plan as the editor shows it: the server's, with the pending edits
// applied in the order they were made. A new zone shows once the server
// has answered with its id.
export function withEdits(plan: PlanResponse, edits: readonly PlanEdit[]): PlanResponse {
  return edits.reduce(withEdit, plan);
}

function withEdit(plan: PlanResponse, edit: PlanEdit): PlanResponse {
  switch (edit.kind) {
    case "updatePlan":
      return { ...plan, ...defined(edit.changes) };
    case "updateZone":
      return {
        ...plan,
        zones: plan.zones.map((zone) => (zone.id === edit.zoneId ? withZoneChanges(zone, edit.changes) : zone)),
      };
    case "deleteZone":
      return withoutZone(plan, edit.zoneId);
    case "createZone":
      return plan;
  }
}

// As the API applies a PATCH: fields left out stay, null is a value (back to
// the frontend default), and each language sent replaces that language
function withZoneChanges(zone: ZoneResponse, { content, ...fields }: ZoneChanges): ZoneResponse {
  return {
    ...zone,
    ...defined(fields),
    ...(content && { content: { en: content.en ?? zone.content.en, ru: content.ru ?? zone.content.ru } }),
  };
}

function defined<T extends object>(fields: T): Partial<T> {
  return Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined)) as Partial<T>;
}

// The server's answers, put into the cached plan

export function withZone(plan: PlanResponse, zone: ZoneResponse): PlanResponse {
  const known = plan.zones.some((item) => item.id === zone.id);
  return {
    ...plan,
    zones: known ? plan.zones.map((item) => (item.id === zone.id ? zone : item)) : [...plan.zones, zone],
  };
}

export function withoutZone(plan: PlanResponse, zoneId: string): PlanResponse {
  return { ...plan, zones: plan.zones.filter((zone) => zone.id !== zoneId) };
}
