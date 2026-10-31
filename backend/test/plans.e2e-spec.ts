import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
// ESM needs the file extension for a subpath of a package without "exports"
import type { App } from "supertest/types.js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DEMO_BACKGROUND, DEMO_PLAN_ID, DEMO_ZONE_IDS, seedDemoPlan } from "../prisma/demo-plan.js";
import { demoPlan } from "../prisma/demo-plan-data.js";
import { configureApp } from "../src/app.js";
import { AppModule } from "../src/app.module.js";
import { PrismaService } from "../src/prisma/prisma.service.js";

describe("plans (e2e)", () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = configureApp(moduleRef.createNestApplication<INestApplication<App>>());
    await app.init();
    prisma = app.get(PrismaService);
    await seedDemoPlan(prisma);
  });

  afterAll(async () => {
    await prisma.floorPlan.deleteMany();
    await app.close();
  });

  it("GET /api/plans/:id returns the demo plan as the frontend defines it", async () => {
    const response = await request(app.getHttpServer()).get(`/api/plans/${DEMO_PLAN_ID}`).expect(200);

    // The demo data in the API's shape: database ids, every field present
    expect(response.body).toEqual({
      id: DEMO_PLAN_ID,
      name: demoPlan.name,
      viewBox: demoPlan.viewBox,
      pxPerMeter: demoPlan.pxPerMeter,
      background: DEMO_BACKGROUND,
      zones: demoPlan.zones.map((zone) => ({
        ...zone,
        id: DEMO_ZONE_IDS[zone.id],
        hitPadding: zone.hitPadding ?? null,
        label: zone.label ?? null,
        version: 1,
      })),
    });
  });

  it("answers 404 for a plan that does not exist", async () => {
    const response = await request(app.getHttpServer())
      .get("/api/plans/00000000-0000-4000-8000-00000000ffff")
      .expect(404);
    expect(response.body).toMatchObject({ message: "Plan 00000000-0000-4000-8000-00000000ffff not found" });
  });

  it("answers 400 for an id that is not a UUID", async () => {
    await request(app.getHttpServer()).get("/api/plans/abc").expect(400);
  });
});
