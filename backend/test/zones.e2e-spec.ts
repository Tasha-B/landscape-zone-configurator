import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
// ESM needs the file extension for a subpath of a package without "exports"
import type { App } from "supertest/types.js";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { configureApp } from "../src/app.js";
import { AppModule } from "../src/app.module.js";
import type { PlanResponse } from "../src/plans/plan.response.js";
import { PrismaService } from "../src/prisma/prisma.service.js";
import type { ZoneResponse } from "../src/zones/zone.response.js";

// Writes through the zone endpoints, on a plan of the test's own. Each test
// starts with a fresh plan; all of them are deleted afterwards.
describe("zone endpoints (e2e)", () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let plan: PlanResponse;
  const plans: string[] = [];

  const unknownId = "00000000-0000-4000-8000-00000000ffff";
  const en = { name: "Reception", tagline: "First impression", recommendation: "Greet", rationale: "Why" };
  const ru = { name: "Ресепшен", tagline: "Первое впечатление", recommendation: "Встречать", rationale: "Зачем" };
  const rect = { kind: "rect", x: 88, y: 98, width: 214, height: 134, rx: 4 };
  const newZone = { type: "reception", shape: rect, color: "#C9962A", content: { en, ru } };

  const http = () => request(app.getHttpServer());
  const readPlan = async (): Promise<PlanResponse> => (await http().get(`/api/plans/${plan.id}`).expect(200)).body;

  const positions = async () =>
    (await prisma.zone.findMany({ where: { planId: plan.id }, orderBy: { position: "asc" } })).map(
      (zone) => zone.position,
    );

  async function createZone(body: object = newZone): Promise<ZoneResponse> {
    return (await http().post(`/api/plans/${plan.id}/zones`).send(body).expect(201)).body;
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = configureApp(moduleRef.createNestApplication<INestApplication<App>>());
    await app.init();
    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    const body = { name: "Zones test", viewBox: [0, 0, 800, 600], pxPerMeter: 32 };
    plan = (await http().post("/api/plans").send(body).expect(201)).body;
    plans.push(plan.id);
  });

  afterAll(async () => {
    await prisma.floorPlan.deleteMany({ where: { id: { in: plans } } });
    await app.close();
  });

  describe("POST /api/plans/:id/zones", () => {
    it("adds a zone at version 1 with defaults for the fields left out", async () => {
      const zone = await createZone();
      expect(zone).toEqual({
        ...newZone,
        id: expect.any(String),
        zIndex: 1,
        hitPadding: null,
        label: null,
        version: 1,
      });
      expect((await readPlan()).zones).toEqual([zone]);
    });

    it("puts new zones last in the legend and above the other zones", async () => {
      const first = await createZone({ ...newZone, zIndex: 5 });
      const second = await createZone({ ...newZone, type: "custom", shape: { kind: "circle", cx: 1, cy: 2, r: 3 } });
      const third = await createZone({ ...newZone, zIndex: 2 });

      expect(second.zIndex).toBe(6);
      expect(third.zIndex).toBe(2);
      expect((await readPlan()).zones.map((zone) => zone.id)).toEqual([first.id, second.id, third.id]);
      // The order comes from position, not from the creation time that only
      // breaks ties
      expect(await positions()).toEqual([0, 1, 2]);
    });

    it("stores every optional field and a polygon as sent", async () => {
      const polygon = {
        kind: "polygon",
        points: [
          [0, 0],
          [40, 0],
          [20, 30.5],
        ],
      };
      const label = { dx: 31, dy: -19, fontSize: 14, areaDy: 20 };
      const zone = await createZone({ ...newZone, shape: polygon, zIndex: 3, hitPadding: 0, label });
      expect(zone).toMatchObject({ shape: polygon, zIndex: 3, hitPadding: 0, label });
      expect((await readPlan()).zones[0]).toEqual(zone);
    });

    it("answers 400 with the field named for an invalid body", async () => {
      const response = await http()
        .post(`/api/plans/${plan.id}/zones`)
        .send({ ...newZone, content: { en } })
        .expect(400);
      expect(response.body.message).toEqual(["content.ru should not be null or undefined"]);

      const shape = await http()
        .post(`/api/plans/${plan.id}/zones`)
        .send({ ...newZone, shape: { kind: "star" } })
        .expect(400);
      expect(shape.body.message).toEqual([expect.stringMatching(/^shape\.kind must be one of/)]);
    });

    it("answers 404 for an unknown plan and 400 for an id that is not a UUID", async () => {
      await http().post(`/api/plans/${unknownId}/zones`).send(newZone).expect(404);
      await http().post("/api/plans/abc/zones").send(newZone).expect(400);
    });
  });

  describe("PATCH /api/zones/:id", () => {
    it("changes the fields sent, replaces shape and label whole, and raises the version", async () => {
      const zone = await createZone({ ...newZone, label: { dx: 1, dy: 2, fontSize: 14 } });
      const circle = { kind: "circle", cx: 100, cy: 120, r: 40 };
      const response = await http()
        .patch(`/api/zones/${zone.id}`)
        .send({ version: 1, type: "break-room", shape: circle, color: "#123456", label: { dx: 5, dy: 6 } })
        .expect(200);

      const expected = {
        ...zone,
        type: "break-room",
        shape: circle,
        color: "#123456",
        label: { dx: 5, dy: 6 },
        version: 2,
      };
      expect(response.body).toEqual(expected);
      expect((await readPlan()).zones).toEqual([expected]);
    });

    it("replaces only the languages sent", async () => {
      const zone = await createZone();
      const changed = { ...ru, name: "Приёмная" };
      const response = await http()
        .patch(`/api/zones/${zone.id}`)
        .send({ version: 1, content: { ru: changed } })
        .expect(200);
      expect(response.body.content).toEqual({ en, ru: changed });
    });

    it("goes back to the frontend defaults with null hitPadding and label", async () => {
      const zone = await createZone({ ...newZone, hitPadding: 0, label: { dx: 1, dy: 2 } });
      const response = await http()
        .patch(`/api/zones/${zone.id}`)
        .send({ version: 1, hitPadding: null, label: null })
        .expect(200);
      expect(response.body).toMatchObject({ hitPadding: null, label: null, version: 2 });
    });

    it("answers 409 for a stale version and changes nothing, content included", async () => {
      const zone = await createZone();
      await http().patch(`/api/zones/${zone.id}`).send({ version: 1, color: "#111111" }).expect(200);

      const response = await http()
        .patch(`/api/zones/${zone.id}`)
        .send({ version: 1, color: "#222222", content: { en: { ...en, name: "Lost" } } })
        .expect(409);
      expect(response.body.message).toMatch(/has been changed/);
      expect((await readPlan()).zones[0]).toMatchObject({ color: "#111111", version: 2, content: { en } });
    });

    it("lets one of two concurrent changes on the same version through", async () => {
      const zone = await createZone();
      const responses = await Promise.all(
        ["#111111", "#222222"].map((color) =>
          http()
            .patch(`/api/zones/${zone.id}`)
            .send({ version: 1, color, content: { en: { ...en, name: color } } }),
        ),
      );

      expect(responses.map((response) => response.status).sort()).toEqual([200, 409]);
      const winner = responses.find((response) => response.status === 200)!.body;
      // The zone and its content come from the same request
      expect((await readPlan()).zones[0]).toMatchObject({
        color: winner.color,
        version: 2,
        content: { en: { name: winner.color } },
      });
    });

    it("answers 400 for a body that changes nothing or sets a required field to null", async () => {
      const zone = await createZone();
      await http().patch(`/api/zones/${zone.id}`).send({ version: 1 }).expect(400);
      await http().patch(`/api/zones/${zone.id}`).send({ version: 1, content: {} }).expect(400);
      await http().patch(`/api/zones/${zone.id}`).send({ version: 1, shape: null }).expect(400);
      await http().patch(`/api/zones/${zone.id}`).send({ version: 1, position: 3 }).expect(400);
      expect((await readPlan()).zones[0].version).toBe(1);
    });

    it("answers 404 for an unknown zone and 400 for an id that is not a UUID", async () => {
      await http().patch(`/api/zones/${unknownId}`).send({ version: 1, color: "#123456" }).expect(404);
      await http().patch("/api/zones/abc").send({ version: 1, color: "#123456" }).expect(400);
    });
  });

  describe("DELETE /api/zones/:id", () => {
    it("deletes the zone and its content, and keeps the others in legend order", async () => {
      const [first, second, third] = [await createZone(), await createZone(), await createZone()];

      await http().delete(`/api/zones/${second.id}`).expect(204);
      expect((await readPlan()).zones.map((zone) => zone.id)).toEqual([first.id, third.id]);
      expect(await prisma.zoneContent.count({ where: { zoneId: second.id } })).toBe(0);

      const fourth = await createZone();
      expect((await readPlan()).zones.map((zone) => zone.id)).toEqual([first.id, third.id, fourth.id]);
      expect(await positions()).toEqual([0, 2, 3]);
    });

    it("answers 404 for an unknown zone and 400 for an id that is not a UUID", async () => {
      await http().delete(`/api/zones/${unknownId}`).expect(404);
      await http().delete("/api/zones/abc").expect(400);
    });
  });
});
