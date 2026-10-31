import type { FloorPlan, Zone, ZoneContent } from "../generated/prisma/client.js";
import { Lang } from "../generated/prisma/enums.js";
import type { PlanResponse, Shape, ZoneContentResponse, ZoneLabel, ZoneResponse } from "./plan.response.js";
import { ZONE_TYPE_NAMES } from "./zone-type.js";

export type PlanRow = FloorPlan & { zones: (Zone & { content: ZoneContent[] })[] };

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
    zones: plan.zones.map(toZoneResponse),
  };
}

function toZoneResponse(zone: PlanRow["zones"][number]): ZoneResponse {
  return {
    id: zone.id,
    type: ZONE_TYPE_NAMES[zone.type],
    // JSON columns, always written whole; the API validates them on write
    // (phase 5), so reading trusts them
    shape: zone.shape as unknown as Shape,
    color: zone.color,
    zIndex: zone.zIndex,
    hitPadding: zone.hitPadding,
    label: zone.label as unknown as ZoneLabel | null,
    version: zone.version,
    content: contentByLang(zone),
  };
}

// The frontend needs every language, so a missing one is an error, not a gap
function contentByLang(zone: PlanRow["zones"][number]): Record<Lang, ZoneContentResponse> {
  const content = {} as Record<Lang, ZoneContentResponse>;
  for (const lang of Object.values(Lang)) {
    const row = zone.content.find((item) => item.lang === lang);
    if (!row) throw new Error(`Zone ${zone.id} has no "${lang}" content`);
    const { name, tagline, recommendation, rationale } = row;
    content[lang] = { name, tagline, recommendation, rationale };
  }
  return content;
}
