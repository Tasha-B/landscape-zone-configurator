import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { io, type Socket } from "socket.io-client";
import request from "supertest";
// ESM needs the file extension for a subpath of a package without "exports"
import type { App } from "supertest/types.js";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { configureApp } from "../src/app.js";
import { AppModule } from "../src/app.module.js";
import type { PlanResponse } from "../src/plans/plan.response.js";
import { PrismaService } from "../src/prisma/prisma.service.js";
import type { ZoneResponse } from "../src/zones/zone.response.js";

// A real server and real sockets. Each event list is compared whole, so a
// test that makes a valid write last also shows that nothing came before it.
describe("plan events (e2e)", () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let url: string;
  let plan: PlanResponse;
  const plans: string[] = [];
  const sockets: Socket[] = [];

  const unknownId = "00000000-0000-4000-8000-00000000ffff";
  const en = { name: "Reception", tagline: "First impression", recommendation: "Greet", rationale: "Why" };
  const ru = { name: "Ресепшен", tagline: "Первое впечатление", recommendation: "Встречать", rationale: "Зачем" };
  const rect = { kind: "rect", x: 88, y: 98, width: 214, height: 134, rx: 4 };
  const newZone = { type: "reception", shape: rect, color: "#C9962A", content: { en, ru } };

  const http = () => request(app.getHttpServer());

  async function createPlan(): Promise<PlanResponse> {
    const body = { name: "Realtime test", viewBox: [0, 0, 800, 600], pxPerMeter: 32 };
    const created: PlanResponse = (await http().post("/api/plans").send(body).expect(201)).body;
    plans.push(created.id);
    return created;
  }

  async function createZone(planId = plan.id): Promise<ZoneResponse> {
    return (await http().post(`/api/plans/${planId}/zones`).send(newZone).expect(201)).body;
  }

  async function connect(): Promise<{ socket: Socket; received: [string, unknown][] }> {
    const socket = io(`${url}/plans`, { path: "/api/socket.io", transports: ["websocket"], forceNew: true });
    sockets.push(socket);
    const received: [string, unknown][] = [];
    socket.onAny((name: string, body: unknown) => received.push([name, body]));
    await new Promise<void>((resolve, reject) => {
      socket.once("connect", resolve);
      socket.once("connect_error", reject);
    });
    return { socket, received };
  }

  const join = (socket: Socket, body: unknown): Promise<{ ok: boolean }> => socket.timeout(2000).emitWithAck("join", body);

  async function watch(planId = plan.id) {
    const watcher = await connect();
    expect(await join(watcher.socket, { planId })).toEqual({ ok: true });
    return watcher;
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = configureApp(moduleRef.createNestApplication<INestApplication<App>>());
    await app.listen(0);
    const { port } = (app.getHttpServer() as unknown as Server).address() as AddressInfo;
    url = `http://127.0.0.1:${port}`;
    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    plan = await createPlan();
  });

  afterEach(() => {
    for (const socket of sockets.splice(0)) socket.disconnect();
  });

  afterAll(async () => {
    await prisma.floorPlan.deleteMany({ where: { id: { in: plans } } });
    await app.close();
  });

  describe("join", () => {
    it("accepts a plan's id, and one that has no plan", async () => {
      const { socket } = await connect();
      expect(await join(socket, { planId: plan.id })).toEqual({ ok: true });
      expect(await join(socket, { planId: unknownId })).toEqual({ ok: true });
    });

    it.each([
      ["an id that is not a UUID", { planId: "not-a-uuid" }],
      ["an id that is not a string", { planId: 42 }],
      ["no id", {}],
      ["null", null],
      ["a string", "plan"],
    ])("refuses %s and stays connected", async (_, body) => {
      const { socket } = await connect();
      expect(await join(socket, body)).toEqual({ ok: false });
      expect(await join(socket, { planId: plan.id })).toEqual({ ok: true });
      expect(socket.connected).toBe(true);
    });

    it("refuses a join sent with no body at all", async () => {
      const { socket } = await connect();
      expect(await socket.timeout(2000).emitWithAck("join")).toEqual({ ok: false });
    });

    it("sends nothing to a socket whose join was refused", async () => {
      const { socket, received } = await connect();
      await join(socket, { planId: "not-a-uuid" });
      const { received: viewer } = await watch();

      await createZone();

      await vi.waitFor(() => expect(viewer).toHaveLength(1));
      expect(received).toEqual([]);
    });
  });

  describe("after a saved change", () => {
    it("sends zone.created with the REST answer", async () => {
      const { received } = await watch();
      const zone = await createZone();
      await vi.waitFor(() => expect(received).toEqual([["zone.created", { planId: plan.id, zone }]]));
    });

    it("sends zone.updated with the REST answer", async () => {
      const created = await createZone();
      const { received } = await watch();

      const zone: ZoneResponse = (
        await http().patch(`/api/zones/${created.id}`).send({ version: 1, color: "#123456" }).expect(200)
      ).body;

      expect(zone.version).toBe(2);
      await vi.waitFor(() => expect(received).toEqual([["zone.updated", { planId: plan.id, zone }]]));
    });

    it("sends zone.deleted with the zone's id", async () => {
      const zone = await createZone();
      const { received } = await watch();

      await http().delete(`/api/zones/${zone.id}`).expect(204);

      await vi.waitFor(() => expect(received).toEqual([["zone.deleted", { planId: plan.id, zoneId: zone.id }]]));
    });

    it("sends plan.updated with the REST answer, without the zones", async () => {
      await createZone();
      const { received } = await watch();

      const { zones, ...fields }: PlanResponse = (
        await http().patch(`/api/plans/${plan.id}`).send({ version: 1, name: "Renamed" }).expect(200)
      ).body;

      expect(zones).toHaveLength(1);
      expect(fields.version).toBe(2);
      await vi.waitFor(() => expect(received).toEqual([["plan.updated", { planId: plan.id, plan: fields }]]));
    });

    it("sends only plan.deleted when a plan goes with its zones", async () => {
      await createZone();
      const { received } = await watch();

      await http().delete(`/api/plans/${plan.id}`).expect(204);

      await vi.waitFor(() => expect(received).toEqual([["plan.deleted", { planId: plan.id }]]));
    });

    it("reaches everyone viewing the plan", async () => {
      const { received: first } = await watch();
      const { received: second } = await watch();

      const zone = await createZone();

      const event = ["zone.created", { planId: plan.id, zone }];
      await vi.waitFor(() => {
        expect(first).toEqual([event]);
        expect(second).toEqual([event]);
      });
    });

    it("keeps the order of changes to a zone", async () => {
      const created = await createZone();
      const { received } = await watch();

      await http().patch(`/api/zones/${created.id}`).send({ version: 1, color: "#111111" }).expect(200);
      await http().patch(`/api/zones/${created.id}`).send({ version: 2, color: "#222222" }).expect(200);

      await vi.waitFor(() => expect(received).toHaveLength(2));
      expect(received.map(([, body]) => (body as { zone: ZoneResponse }).zone.version)).toEqual([2, 3]);
    });
  });

  describe("rooms", () => {
    it("sends nothing to another plan's viewers", async () => {
      const other = await createPlan();
      const { received: otherViewer } = await watch(other.id);

      await createZone();
      const zone = await createZone(other.id);

      await vi.waitFor(() => expect(otherViewer).toEqual([["zone.created", { planId: other.id, zone }]]));
    });

    it("sends nothing to a socket that has not joined", async () => {
      const { received: bystander } = await connect();
      const { received: viewer } = await watch();

      await createZone();

      await vi.waitFor(() => expect(viewer).toHaveLength(1));
      expect(bystander).toEqual([]);
    });

    it("leaves the first plan when joining a second", async () => {
      const other = await createPlan();
      const { socket, received } = await watch();
      await join(socket, { planId: other.id });

      await createZone();
      const zone = await createZone(other.id);

      await vi.waitFor(() => expect(received).toEqual([["zone.created", { planId: other.id, zone }]]));
    });

    it("stays in the room after a refused join", async () => {
      const { socket, received } = await watch();
      await join(socket, { planId: "not-a-uuid" });

      const zone = await createZone();

      await vi.waitFor(() => expect(received).toEqual([["zone.created", { planId: plan.id, zone }]]));
    });
  });

  describe("after a rejected write", () => {
    it("sends nothing", async () => {
      const zone = await createZone();
      const zoneUrl = `/api/zones/${zone.id}`;
      await http().patch(zoneUrl).send({ version: 1, color: "#111111" }).expect(200);
      const { received } = await watch();

      await http().post(`/api/plans/${plan.id}/zones`).send({}).expect(400);
      await http().post(`/api/plans/${unknownId}/zones`).send(newZone).expect(404);
      await http().patch(zoneUrl).send({ version: 2, color: "not a color" }).expect(400);
      await http().patch(zoneUrl).send({ version: 2 }).expect(400);
      // The version the first change used, now stale
      await http().patch(zoneUrl).send({ version: 1, color: "#222222" }).expect(409);
      await http().patch(`/api/zones/${unknownId}`).send({ version: 1, color: "#222222" }).expect(404);
      await http().delete(`/api/zones/${unknownId}`).expect(404);
      await http().patch(`/api/plans/${plan.id}`).send({ version: 1, name: "" }).expect(400);
      await http().patch(`/api/plans/${plan.id}`).send({ version: 9, name: "Stale" }).expect(409);
      await http().delete(`/api/plans/${unknownId}`).expect(404);

      // The first event to arrive is the one of this valid write
      const last: ZoneResponse = (await http().patch(zoneUrl).send({ version: 2, color: "#333333" }).expect(200)).body;
      await vi.waitFor(() => expect(received).toEqual([["zone.updated", { planId: plan.id, zone: last }]]));
    });
  });
});
