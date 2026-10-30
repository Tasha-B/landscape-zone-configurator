// The demo office from phase 1, loaded into the database. The data comes
// from the frontend, so the office has one source until phase 4 moves it
// into the backend.
import { demoPlan } from "../../frontend/src/data/demoPlan.js";
import { Lang, ZoneType, type PrismaClient } from "../src/generated/prisma/client.js";

// Fixed ids: reseeding gives the same plan and zone ids, so URLs and later
// references to them stay valid
export const DEMO_PLAN_ID = "00000000-0000-4000-8000-000000000001";

export const DEMO_ZONE_IDS: Record<string, string> = {
  reception: "00000000-0000-4000-8000-000000000101",
  "meeting-room": "00000000-0000-4000-8000-000000000102",
  "open-floor": "00000000-0000-4000-8000-000000000103",
  "break-room": "00000000-0000-4000-8000-000000000104",
  "signature-corner": "00000000-0000-4000-8000-000000000105",
};

// The frontend's zone types are the strings the database stores; the
// Prisma client names them in SCREAMING_CASE
const ZONE_TYPES = {
  reception: ZoneType.RECEPTION,
  "meeting-room": ZoneType.MEETING_ROOM,
  "open-floor": ZoneType.OPEN_FLOOR,
  "break-room": ZoneType.BREAK_ROOM,
  "signature-corner": ZoneType.SIGNATURE_CORNER,
  custom: ZoneType.CUSTOM,
} as const;

// Replaces the demo plan, if present, in one transaction. Zones and their
// content cascade; other plans are not touched.
export async function seedDemoPlan(prisma: PrismaClient): Promise<void> {
  await prisma.$transaction([
    prisma.floorPlan.deleteMany({ where: { id: DEMO_PLAN_ID } }),
    prisma.floorPlan.create({
      data: {
        id: DEMO_PLAN_ID,
        name: demoPlan.name,
        viewBox: demoPlan.viewBox,
        pxPerMeter: demoPlan.pxPerMeter,
        zones: {
          create: demoPlan.zones.map((zone, position) => {
            const id = DEMO_ZONE_IDS[zone.id];
            if (!id) throw new Error(`No fixed id for demo zone "${zone.id}"`);
            return {
              id,
              type: ZONE_TYPES[zone.type],
              shape: zone.shape,
              color: zone.color,
              zIndex: zone.zIndex,
              position,
              hitPadding: zone.hitPadding ?? null,
              label: zone.label,
              content: {
                create: [Lang.en, Lang.ru].map((lang) => ({ lang, ...zone.content[lang] })),
              },
            };
          }),
        },
      },
    }),
  ]);
}
