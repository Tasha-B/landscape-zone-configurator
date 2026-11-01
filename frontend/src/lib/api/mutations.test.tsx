// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useEditedPlan, usePlanEdits, type SaveErrorKind } from "./mutations";
import type { PlanResponse, ZoneResponse } from "./types";

const en = { name: "Reception", tagline: "t", recommendation: "r", rationale: "w" };
const ru = { name: "Ресепшен", tagline: "т", recommendation: "р", rationale: "п" };

function zone(id: string, overrides: Partial<ZoneResponse> = {}): ZoneResponse {
  return {
    id,
    type: "reception",
    shape: { kind: "rect", x: 10, y: 20, width: 100, height: 50, rx: 4 },
    color: "#C9962A",
    zIndex: 1,
    hitPadding: null,
    label: null,
    version: 1,
    content: { en, ru },
    ...overrides,
  };
}

// A stand-in for the API that keeps one plan and checks versions like the
// real one. `hold()` keeps the answers to writes back until `release()`;
// `failNext` answers the next write with that status.
function fakeApi() {
  let plan: PlanResponse = {
    id: "p1",
    name: "Office",
    viewBox: [0, 0, 800, 600],
    pxPerMeter: 32,
    background: null,
    version: 1,
    zones: [zone("a"), zone("b")],
  };
  let gate: Promise<void> | null = null;
  let open = () => {};
  const api = {
    writes: [] as { method: string; url: string; body: Record<string, unknown> | undefined }[],
    gets: 0,
    failNext: null as number | null,
    get plan() {
      return plan;
    },
    set plan(value: PlanResponse) {
      plan = value;
    },
    hold() {
      gate = new Promise((resolve) => (open = resolve));
    },
    release() {
      gate = null;
      open();
    },
  };

  const conflict = () => Response.json({ statusCode: 409, message: "changed" }, { status: 409 });

  vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
    const method = init.method ?? "GET";
    if (method === "GET") {
      api.gets++;
      return Response.json(plan);
    }
    const body = init.body ? (JSON.parse(init.body as string) as Record<string, unknown>) : undefined;
    api.writes.push({ method, url, body });
    while (gate) await gate;
    if (api.failNext) {
      const status = api.failNext;
      api.failNext = null;
      return Response.json({ statusCode: status, message: "failed" }, { status });
    }
    const zoneId = url.match(/\/api\/zones\/(.+)$/)?.[1];
    if (method === "PATCH" && zoneId) {
      const current = plan.zones.find((item) => item.id === zoneId)!;
      if (body!.version !== current.version) return conflict();
      const { version: _, content, ...fields } = body!;
      const next = {
        ...current,
        ...fields,
        content: { ...current.content, ...(content as object) },
        version: current.version + 1,
      } as ZoneResponse;
      plan = { ...plan, zones: plan.zones.map((item) => (item.id === zoneId ? next : item)) };
      return Response.json(next);
    }
    if (method === "DELETE" && zoneId) {
      plan = { ...plan, zones: plan.zones.filter((item) => item.id !== zoneId) };
      return new Response(null, { status: 204 });
    }
    if (method === "POST") {
      const created = { ...zone(`new-${plan.zones.length}`), ...body, zIndex: 9 } as ZoneResponse;
      plan = { ...plan, zones: [...plan.zones, created] };
      return Response.json(created, { status: 201 });
    }
    if (method === "PATCH") {
      if (body!.version !== plan.version) return conflict();
      const { version: _, ...fields } = body!;
      plan = { ...plan, ...fields, version: plan.version + 1 } as PlanResponse;
      return Response.json(plan);
    }
    throw new Error(`Unexpected ${method} ${url}`);
  });
  return api;
}

describe("editing a plan", () => {
  let api: ReturnType<typeof fakeApi>;
  let errors: SaveErrorKind[];

  beforeEach(() => {
    api = fakeApi();
    errors = [];
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  async function renderEditor() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const hook = renderHook(
      () => ({
        plan: useEditedPlan("p1"),
        edits: usePlanEdits("p1", { onSaveError: (kind) => errors.push(kind) }),
      }),
      { wrapper },
    );
    await waitFor(() => expect(hook.result.current.plan.data).toBeDefined());
    return hook;
  }

  const zoneOf = (plan: PlanResponse | undefined, id: string) => plan?.zones.find((item) => item.id === id);
  const settled = (hook: Awaited<ReturnType<typeof renderEditor>>) =>
    waitFor(() => expect(hook.result.current.plan.saving).toBe(false));

  it("shows a change before the answer and keeps it after, at the next version", async () => {
    const hook = await renderEditor();
    api.hold();

    act(() => hook.result.current.edits.updateZone("a", { color: "#000000" }));
    await waitFor(() => expect(zoneOf(hook.result.current.plan.data, "a")?.color).toBe("#000000"));
    expect(hook.result.current.plan.saving).toBe(true);

    api.release();
    await settled(hook);
    expect(zoneOf(hook.result.current.plan.data, "a")).toMatchObject({ color: "#000000", version: 2 });
    expect(errors).toEqual([]);
  });

  it("sends two quick changes one at a time, with versions 1 and 2", async () => {
    const hook = await renderEditor();
    api.hold();

    act(() => {
      hook.result.current.edits.updateZone("a", { color: "#111111" });
      hook.result.current.edits.updateZone("a", { color: "#222222" });
    });
    await waitFor(() => expect(api.writes).toHaveLength(1));
    expect(zoneOf(hook.result.current.plan.data, "a")?.color).toBe("#222222");

    api.release();
    await settled(hook);
    expect(api.writes.map((write) => write.body?.version)).toEqual([1, 2]);
    expect(zoneOf(hook.result.current.plan.data, "a")).toMatchObject({ color: "#222222", version: 3 });
    expect(errors).toEqual([]);
  });

  it("drops a change the API refused and reloads the plan", async () => {
    const hook = await renderEditor();
    const gets = api.gets;
    api.failNext = 500;

    act(() => hook.result.current.edits.updateZone("a", { color: "#000000" }));
    await settled(hook);

    expect(errors).toEqual(["failed"]);
    expect(zoneOf(hook.result.current.plan.data, "a")).toMatchObject({ color: "#C9962A", version: 1 });
    expect(api.gets).toBeGreaterThan(gets);
  });

  it("reloads the plan with the other change after a 409", async () => {
    const hook = await renderEditor();
    // Changed meanwhile in another tab
    api.plan = { ...api.plan, zones: [zone("a", { color: "#333333", version: 2 }), api.plan.zones[1]] };

    act(() => hook.result.current.edits.updateZone("a", { color: "#000000" }));
    await settled(hook);

    expect(errors).toEqual(["conflict"]);
    await waitFor(() =>
      expect(zoneOf(hook.result.current.plan.data, "a")).toMatchObject({ color: "#333333", version: 2 }),
    );
  });

  it("sends a change queued behind a 409 with the reloaded version", async () => {
    const hook = await renderEditor();
    api.plan = { ...api.plan, zones: [zone("a", { color: "#333333", version: 2 }), api.plan.zones[1]] };

    act(() => {
      hook.result.current.edits.updateZone("a", { color: "#000000" });
      hook.result.current.edits.updateZone("a", { zIndex: 7 });
    });
    await settled(hook);

    expect(api.writes.map((write) => write.body?.version)).toEqual([1, 2]);
    expect(errors).toEqual(["conflict"]);
    expect(zoneOf(hook.result.current.plan.data, "a")).toMatchObject({ color: "#333333", zIndex: 7, version: 3 });
  });

  it("hides a deleted zone at once and adds a new one after the answer", async () => {
    const hook = await renderEditor();
    api.hold();

    act(() => hook.result.current.edits.deleteZone("a"));
    await waitFor(() => expect(hook.result.current.plan.data?.zones.map((item) => item.id)).toEqual(["b"]));

    const body = { type: "custom" as const, shape: zone("x").shape, color: "#123456", content: { en, ru } };
    let created: Promise<ZoneResponse> | undefined;
    act(() => {
      created = hook.result.current.edits.createZone(body);
    });
    expect(hook.result.current.plan.data?.zones).toHaveLength(1);

    api.release();
    const zoneCreated = await created!;
    await settled(hook);
    expect(hook.result.current.plan.data?.zones.map((item) => item.id)).toEqual(["b", zoneCreated.id]);
    expect(api.writes.map((write) => `${write.method} ${write.url}`)).toEqual([
      "DELETE /api/zones/a",
      "POST /api/plans/p1/zones",
    ]);
  });

  it("changes the plan with its version and keeps its zones", async () => {
    const hook = await renderEditor();
    api.hold();

    act(() => hook.result.current.edits.updatePlan({ name: "Renamed", viewBox: [0, 0, 1000, 700] }));
    await waitFor(() => expect(hook.result.current.plan.data?.name).toBe("Renamed"));

    api.release();
    await settled(hook);
    expect(api.writes[0].body).toEqual({ name: "Renamed", viewBox: [0, 0, 1000, 700], version: 1 });
    expect(hook.result.current.plan.data).toMatchObject({ name: "Renamed", version: 2 });
    expect(hook.result.current.plan.data?.zones).toHaveLength(2);
  });
});
