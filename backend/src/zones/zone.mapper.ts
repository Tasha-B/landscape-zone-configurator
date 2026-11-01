import type { Zone, ZoneContent as ZoneContentRow } from "../generated/prisma/client.js";
import { Lang } from "../generated/prisma/enums.js";
import type { Shape } from "./shape.js";
import { ZONE_TYPE_NAMES } from "./zone-type.js";
import type { ZoneContent, ZoneLabel, ZoneResponse } from "./zone.response.js";

export type ZoneRow = Zone & { content: ZoneContentRow[] };

// Turns a zone read with its content into the API response. Used for the
// zones of a plan and for the zone endpoints alike.
export function toZoneResponse(zone: ZoneRow): ZoneResponse {
  return {
    id: zone.id,
    type: ZONE_TYPE_NAMES[zone.type],
    // JSON columns, always written whole and validated on write, so reading
    // trusts them
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
function contentByLang(zone: ZoneRow): Record<Lang, ZoneContent> {
  const content = {} as Record<Lang, ZoneContent>;
  for (const lang of Object.values(Lang)) {
    const row = zone.content.find((item) => item.lang === lang);
    if (!row) throw new Error(`Zone ${zone.id} has no "${lang}" content`);
    const { name, tagline, recommendation, rationale } = row;
    content[lang] = { name, tagline, recommendation, rationale };
  }
  return content;
}
