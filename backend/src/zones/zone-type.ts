import { ZoneType } from "../generated/prisma/enums.js";

// The database and the API use the frontend's strings ("meeting-room"); the
// Prisma client names the same values in SCREAMING_CASE
export const ZONE_TYPE_NAMES = {
  [ZoneType.RECEPTION]: "reception",
  [ZoneType.MEETING_ROOM]: "meeting-room",
  [ZoneType.OPEN_FLOOR]: "open-floor",
  [ZoneType.BREAK_ROOM]: "break-room",
  [ZoneType.SIGNATURE_CORNER]: "signature-corner",
  [ZoneType.CUSTOM]: "custom",
} as const satisfies Record<ZoneType, string>;

export type ZoneTypeName = (typeof ZONE_TYPE_NAMES)[ZoneType];
