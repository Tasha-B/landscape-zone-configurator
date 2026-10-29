import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { demoPlan } from "../../frontend/src/data/demoPlan.js";
import { DEMO_PLAN_ID, DEMO_ZONE_IDS, seedDemoPlan } from "../prisma/demo-plan.js";
import { PrismaClient, ZoneType } from "../src/generated/prisma/client.js";

const zoneTypeNames = Object.fromEntries(
  Object.entries({
    reception: ZoneType.RECEPTION,
    "meeting-room": ZoneType.MEETING_ROOM,
    "open-floor": ZoneType.OPEN_FLOOR,
    "break-room": ZoneType.BREAK_ROOM,
    "signature-corner": ZoneType.SIGNATURE_CORNER,
    custom: ZoneType.CUSTOM,
  }).map(([name, value]) => [value, name]),
);

describe("demo plan seed (e2e)", () => {
  let prisma: PrismaClient;

  beforeAll(() => {
    prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
    });
  });

  afterAll(async () => {
    await prisma.floorPlan.deleteMany();
    await prisma.$disconnect();
  });

  it("stores the demo plan exactly as the frontend defines it", async () => {
    await seedDemoPlan(prisma);

    const plan = await prisma.floorPlan.findUniqueOrThrow({
      where: { id: DEMO_PLAN_ID },
      include: { zones: { orderBy: { position: "asc" }, include: { content: true } } },
    });

    // Read back into the frontend's FloorPlan shape; only the ids differ
    const stored = {
      name: plan.name,
      viewBox: plan.viewBox,
      pxPerMeter: plan.pxPerMeter,
      zones: plan.zones.map((zone) => ({
        id: zone.id,
        type: zoneTypeNames[zone.type],
        shape: zone.shape,
        color: zone.color,
        zIndex: zone.zIndex,
        ...(zone.hitPadding !== null && { hitPadding: zone.hitPadding }),
        ...(zone.label !== null && { label: zone.label }),
        content: Object.fromEntries(
          zone.content.map(({ lang, name, tagline, recommendation, rationale }) => [
            lang,
            { name, tagline, recommendation, rationale },
          ]),
        ),
      })),
    };

    expect(stored).toEqual({
      name: demoPlan.name,
      viewBox: demoPlan.viewBox,
      pxPerMeter: demoPlan.pxPerMeter,
      zones: demoPlan.zones.map((zone) => ({ ...zone, id: DEMO_ZONE_IDS[zone.id] })),
    });
  });

  it("replaces the demo plan when run again, keeping its ids", async () => {
    await seedDemoPlan(prisma);
    await seedDemoPlan(prisma);

    expect(await prisma.floorPlan.count()).toBe(1);
    const zones = await prisma.zone.findMany({ select: { id: true }, orderBy: { position: "asc" } });
    expect(zones.map((zone) => zone.id)).toEqual(Object.values(DEMO_ZONE_IDS));
    expect(await prisma.zoneContent.count()).toBe(10);
  });

  it("leaves other plans alone", async () => {
    await prisma.floorPlan.create({
      data: { name: "Another office", viewBox: [0, 0, 100, 100], pxPerMeter: 10 },
    });

    await seedDemoPlan(prisma);

    expect(await prisma.floorPlan.count()).toBe(2);
    expect(await prisma.floorPlan.count({ where: { name: "Another office" } })).toBe(1);
  });
});
