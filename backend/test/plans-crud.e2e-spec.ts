import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
// ESM needs the file extension for a subpath of a package without "exports"
import type { App } from "supertest/types.js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Lang, ZoneType } from "../src/generated/prisma/client.js";
import { configureApp } from "../src/app.js";
import { AppModule } from "../src/app.module.js";
import type { PlanResponse } from "../src/plans/plan.response.js";
import { PrismaService } from "../src/prisma/prisma.service.js";

// Writes through the plan endpoints. Every plan here is created by the test
// itself and deleted afterwards; the demo plan is left to plans.e2e-spec.ts.
describe("plan endpoints (e2e)", () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const created: string[] = [];

  const newPlan = { name: "Second floor", viewBox: [0, 0, 1000, 700], pxPerMeter: 25 };
  const unknownId = "00000000-0000-4000-8000-00000000ffff";

  const http = () => request(app.getHttpServer());

  async function createPlan(body: object = newPlan): Promise<PlanResponse> {
    const response = await http().post("/api/plans").send(body).expect(201);
    created.push(response.body.id);
    return response.body;
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = configureApp(moduleRef.createNestApplication<INestApplication<App>>());
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await prisma.floorPlan.deleteMany({ where: { id: { in: created } } });
    await app.close();
  });

  describe("POST /api/plans", () => {
    it("creates a plan without zones at version 1, readable by id", async () => {
      const plan = await createPlan({ ...newPlan, background: "demo-office" });
      const expected = { ...newPlan, id: plan.id, background: "demo-office", version: 1, zones: [] };
      expect(plan).toEqual(expected);
      expect((await http().get(`/api/plans/${plan.id}`).expect(200)).body).toEqual(expected);
    });

    it("leaves the background blank when none is sent", async () => {
      expect((await createPlan()).background).toBeNull();
    });

    it("answers 400 with the field named for an invalid body", async () => {
      const response = await http()
        .post("/api/plans")
        .send({ ...newPlan, viewBox: [0, 0, 0, 700] })
        .expect(400);
      expect(response.body.message).toEqual([expect.stringMatching(/^viewBox /)]);
    });

    it("answers 400 for an unknown field", async () => {
      const response = await http()
        .post("/api/plans")
        .send({ ...newPlan, zones: [] })
        .expect(400);
      expect(response.body.message).toEqual(["property zones should not exist"]);
    });
  });

  describe("GET /api/plans", () => {
    it("lists plans oldest first with their zone count", async () => {
      const first = await createPlan({ ...newPlan, name: "List A" });
      const second = await createPlan({ ...newPlan, name: "List B", background: "demo-office" });
      await prisma.zone.create({
        data: {
          planId: second.id,
          type: ZoneType.CUSTOM,
          shape: { kind: "circle", cx: 10, cy: 10, r: 5 },
          color: "#123456",
          zIndex: 1,
          position: 0,
          content: {
            create: [Lang.en, Lang.ru].map((lang) => ({
              lang,
              name: "n",
              tagline: "t",
              recommendation: "r",
              rationale: "w",
            })),
          },
        },
      });

      const { body } = await http().get("/api/plans").expect(200);
      const ours = body.filter((plan: { id: string }) => [first.id, second.id].includes(plan.id));
      expect(ours).toEqual([
        { id: first.id, name: "List A", background: null, zoneCount: 0, updatedAt: expect.any(String) },
        { id: second.id, name: "List B", background: "demo-office", zoneCount: 1, updatedAt: expect.any(String) },
      ]);
      expect(new Date(ours[0].updatedAt).toISOString()).toBe(ours[0].updatedAt);
    });
  });

  describe("PATCH /api/plans/:id", () => {
    it("changes the fields sent and raises the version", async () => {
      const plan = await createPlan({ ...newPlan, background: "demo-office" });
      const response = await http()
        .patch(`/api/plans/${plan.id}`)
        .send({ version: 1, name: "Renamed", background: null })
        .expect(200);

      const expected = { ...newPlan, id: plan.id, name: "Renamed", background: null, version: 2, zones: [] };
      expect(response.body).toEqual(expected);
      expect((await http().get(`/api/plans/${plan.id}`).expect(200)).body).toEqual(expected);
    });

    it("answers 409 for a stale version and changes nothing", async () => {
      const plan = await createPlan();
      await http().patch(`/api/plans/${plan.id}`).send({ version: 1, name: "First" }).expect(200);

      const response = await http().patch(`/api/plans/${plan.id}`).send({ version: 1, name: "Second" }).expect(409);
      expect(response.body.message).toMatch(/has been changed/);
      const stored = (await http().get(`/api/plans/${plan.id}`).expect(200)).body;
      expect(stored).toMatchObject({ name: "First", version: 2 });
    });

    it("lets one of two concurrent changes on the same version through", async () => {
      const plan = await createPlan();
      const responses = await Promise.all(
        ["One", "Two"].map((name) => http().patch(`/api/plans/${plan.id}`).send({ version: 1, name })),
      );

      expect(responses.map((response) => response.status).sort()).toEqual([200, 409]);
      const winner = responses.find((response) => response.status === 200)!.body;
      const stored = (await http().get(`/api/plans/${plan.id}`).expect(200)).body;
      expect(stored).toMatchObject({ name: winner.name, version: 2 });
    });

    it("answers 400 for a body that changes nothing, null for a required field, or no version", async () => {
      const plan = await createPlan();
      await http().patch(`/api/plans/${plan.id}`).send({ version: 1 }).expect(400);
      await http().patch(`/api/plans/${plan.id}`).send({ version: 1, name: null }).expect(400);
      await http().patch(`/api/plans/${plan.id}`).send({ name: "No version" }).expect(400);
      expect((await http().get(`/api/plans/${plan.id}`).expect(200)).body.version).toBe(1);
    });

    it("answers 404 for an unknown plan and 400 for an id that is not a UUID", async () => {
      await http().patch(`/api/plans/${unknownId}`).send({ version: 1, name: "x" }).expect(404);
      await http().patch("/api/plans/abc").send({ version: 1, name: "x" }).expect(400);
    });
  });

  describe("DELETE /api/plans/:id", () => {
    it("deletes the plan with its zones and their content", async () => {
      const plan = await createPlan();
      const zone = await prisma.zone.create({
        data: {
          planId: plan.id,
          type: ZoneType.CUSTOM,
          shape: { kind: "circle", cx: 10, cy: 10, r: 5 },
          color: "#123456",
          zIndex: 1,
          position: 0,
          content: { create: [{ lang: Lang.en, name: "n", tagline: "t", recommendation: "r", rationale: "w" }] },
        },
      });

      await http().delete(`/api/plans/${plan.id}`).expect(204);
      await http().get(`/api/plans/${plan.id}`).expect(404);
      expect(await prisma.zone.count({ where: { id: zone.id } })).toBe(0);
      expect(await prisma.zoneContent.count({ where: { zoneId: zone.id } })).toBe(0);
    });

    it("answers 404 for an unknown plan and 400 for an id that is not a UUID", async () => {
      await http().delete(`/api/plans/${unknownId}`).expect(404);
      await http().delete("/api/plans/abc").expect(400);
    });
  });
});
