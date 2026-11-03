// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sockets, type FakeSocket } from "./fakeSocket";
import { usePlanLive } from "./live";
import { planKey, usePlanResponse } from "./plans";
import type { PlanResponse, ZoneResponse } from "./types";

vi.mock("socket.io-client", () => import("./fakeSocket"));

const PLAN = "p1";
const text = { name: "Zone", tagline: "t", recommendation: "r", rationale: "w" };

function zone(id: string, overrides: Partial<ZoneResponse> = {}): ZoneResponse {
  return {
    id,
    type: "custom",
    shape: { kind: "circle", cx: 10, cy: 10, r: 5 },
    color: "#111111",
    zIndex: 1,
    hitPadding: null,
    label: null,
    version: 2,
    content: { en: text, ru: text },
    ...overrides,
  };
}

const initialPlan = (): PlanResponse => ({
  id: PLAN,
  name: "Office",
  viewBox: [0, 0, 800, 600],
  pxPerMeter: 32,
  background: null,
  version: 2,
  zones: [zone("a"), zone("b")],
});

describe("usePlanLive", () => {
  let server: PlanResponse | null;
  let gets: number;
  let signals: AbortSignal[];
  // When set, a GET waits for it, and answers with the plan as of its start
  let gate: Promise<void> | null;

  beforeEach(() => {
    sockets.length = 0;
    server = initialPlan();
    gets = 0;
    signals = [];
    gate = null;
    vi.stubGlobal("fetch", async (_url: string, init: RequestInit) => {
      gets++;
      signals.push(init.signal!);
      const answer = server;
      if (gate) await gate;
      return answer
        ? Response.json(answer)
        : Response.json({ statusCode: 404, message: "Plan not found" }, { status: 404 });
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  async function setup() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const hook = renderHook(() => ({ live: usePlanLive(PLAN), plan: usePlanResponse(PLAN) }), { wrapper });
    await waitFor(() => expect(hook.result.current.plan.data).toBeDefined());
    const socket = sockets.at(-1)!;
    return { ...hook, client, socket };
  }

  // Connected and joined, with the refetch after joining finished
  async function joined() {
    const context = await setup();
    await receive(context.socket, "connect");
    const before = gets;
    await act(async () => context.socket.answerJoin());
    await waitFor(() => expect(gets).toBe(before + 1));
    await waitFor(() => expect(context.client.isFetching()).toBe(0));
    return context;
  }

  // TanStack Query tells React on the next timer tick, so a test waits for it
  const receive = (socket: FakeSocket, name: string, ...args: unknown[]) =>
    act(async () => {
      socket.receive(name, ...args);
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

  describe("the connection", () => {
    it("opens the namespace under /api", async () => {
      const { socket } = await setup();
      expect(socket.url).toBe("/plans");
      expect(socket.options).toMatchObject({ path: "/api/socket.io" });
    });

    it("joins on connecting, and is live on the acknowledgement", async () => {
      const { socket, result } = await setup();
      expect(result.current.live).toBe("connecting");
      expect(socket.joinBodies).toEqual([]);

      await receive(socket, "connect");
      expect(socket.joinBodies).toEqual([{ planId: PLAN }]);
      expect(result.current.live).toBe("connecting");

      await act(async () => socket.answerJoin());
      expect(result.current.live).toBe("live");
    });

    it("refetches once joined, so a change saved before that shows", async () => {
      const { socket, result } = await setup();
      await receive(socket, "connect");
      server = { ...server!, name: "Changed before joining" };

      await act(async () => socket.answerJoin());

      await waitFor(() => expect(result.current.plan.data?.name).toBe("Changed before joining"));
    });

    it("does not refetch or go live when the join is refused", async () => {
      const { socket, result } = await setup();
      await receive(socket, "connect");
      const before = gets;

      await act(async () => socket.answerJoin(false));

      expect(gets).toBe(before);
      expect(result.current.live).toBe("connecting");
    });

    it("is lost when the connection goes, and catches up when it returns", async () => {
      const { socket, result } = await joined();

      await receive(socket, "disconnect");
      expect(result.current.live).toBe("lost");
      server = { ...server!, name: "Changed meanwhile" };

      await receive(socket, "connect");
      expect(socket.joinBodies).toHaveLength(2);
      await act(async () => socket.answerJoin());

      expect(result.current.live).toBe("live");
      await waitFor(() => expect(result.current.plan.data?.name).toBe("Changed meanwhile"));
    });

    it("is lost when it cannot connect", async () => {
      const { socket, result } = await setup();
      await receive(socket, "connect_error", new Error("refused"));
      expect(result.current.live).toBe("lost");
    });

    it("disconnects when unmounted", async () => {
      const { socket, unmount } = await setup();
      expect(socket.disconnected).toBe(false);
      unmount();
      expect(socket.disconnected).toBe(true);
    });
  });

  describe("events", () => {
    it("zone.created adds the zone, without a request", async () => {
      const { socket, result } = await joined();
      const before = gets;

      await receive(socket, "zone.created", { planId: PLAN, zone: zone("c") });

      expect(result.current.plan.data?.zones.map((item) => item.id)).toEqual(["a", "b", "c"]);
      expect(gets).toBe(before);
    });

    it("zone.updated replaces the zone, without a request", async () => {
      const { socket, result } = await joined();
      const before = gets;
      const changed = zone("a", { color: "#222222", version: 3 });

      await receive(socket, "zone.updated", { planId: PLAN, zone: changed });

      expect(result.current.plan.data?.zones[0]).toEqual(changed);
      expect(gets).toBe(before);
    });

    it("zone.updated at an older version is ignored", async () => {
      const { socket, result } = await joined();

      await receive(socket, "zone.updated", { planId: PLAN, zone: zone("a", { color: "#222222", version: 1 }) });

      expect(result.current.plan.data?.zones[0].color).toBe("#111111");
    });

    it("zone.updated for an unknown zone refetches", async () => {
      const { socket, result } = await joined();
      const missed = zone("c");
      server = { ...server!, zones: [...server!.zones, missed] };

      await receive(socket, "zone.updated", { planId: PLAN, zone: missed });

      await waitFor(() => expect(result.current.plan.data?.zones.map((item) => item.id)).toEqual(["a", "b", "c"]));
    });

    it("zone.deleted removes the zone, also when it comes twice", async () => {
      const { socket, result } = await joined();

      await receive(socket, "zone.deleted", { planId: PLAN, zoneId: "a" });
      await receive(socket, "zone.deleted", { planId: PLAN, zoneId: "a" });

      expect(result.current.plan.data?.zones.map((item) => item.id)).toEqual(["b"]);
    });

    it("plan.updated takes the fields and keeps the zones", async () => {
      const { socket, result } = await joined();
      const { zones: _zones, ...fields } = initialPlan();

      await receive(socket, "plan.updated", { planId: PLAN, plan: { ...fields, name: "Renamed", version: 3 } });

      expect(result.current.plan.data).toMatchObject({ name: "Renamed", version: 3 });
      expect(result.current.plan.data?.zones).toHaveLength(2);
    });

    it("plan.deleted drops the data, and the refetch reports the 404", async () => {
      const { socket, result } = await joined();
      server = null;

      await receive(socket, "plan.deleted", { planId: PLAN });

      await waitFor(() => expect(result.current.plan.isError).toBe(true));
      expect(result.current.plan.data).toBeUndefined();
    });

    it("does nothing while no plan is cached", async () => {
      const { socket, client } = await joined();
      client.removeQueries({ queryKey: planKey(PLAN) });

      await receive(socket, "zone.created", { planId: PLAN, zone: zone("c") });

      expect(client.getQueryData(planKey(PLAN))).toBeUndefined();
    });
  });

  describe("an event during a fetch", () => {
    it("cancels a GET that could answer with older data and asks again", async () => {
      const { socket, result, client } = await joined();
      let open = () => {};
      gate = new Promise((resolve) => (open = resolve));
      void client.refetchQueries({ queryKey: planKey(PLAN) });
      await waitFor(() => expect(client.isFetching()).toBe(1));
      const started = signals.at(-1)!;
      const before = gets;

      const changed = zone("a", { color: "#222222", version: 3 });
      server = { ...server!, zones: [changed, server!.zones[1]] };
      gate = null;
      await receive(socket, "zone.updated", { planId: PLAN, zone: changed });
      open();

      expect(started.aborted).toBe(true);
      await waitFor(() => expect(gets).toBe(before + 1));
      await waitFor(() => expect(client.isFetching()).toBe(0));
      expect(result.current.plan.data?.zones[0].color).toBe("#222222");
    });
  });
});
