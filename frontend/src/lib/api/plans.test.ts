import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "./client";
import {
  createPlan,
  createZone,
  deletePlan,
  deleteZone,
  fetchPlan,
  listPlans,
  toFloorPlan,
  updatePlan,
  updateZone,
} from "./plans";
import { shouldRetry } from "./queryClient";
import type { PlanResponse, ZoneResponse } from "./types";

const content = { name: "Reception", tagline: "t", recommendation: "r", rationale: "why" };

function zone(overrides: Partial<ZoneResponse> = {}): ZoneResponse {
  return {
    id: "00000000-0000-4000-8000-000000000101",
    type: "reception",
    shape: { kind: "rect", x: 1, y: 2, width: 3, height: 4, rx: 5 },
    color: "#C9962A",
    zIndex: 1,
    hitPadding: null,
    label: null,
    version: 2,
    content: { en: content, ru: { ...content, name: "Ресепшен" } },
    ...overrides,
  };
}

function plan(zones: ZoneResponse[]): PlanResponse {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    name: "Office",
    viewBox: [0, 0, 800, 600],
    pxPerMeter: 32,
    background: "demo-office",
    version: 3,
    zones,
  };
}

describe("toFloorPlan", () => {
  it("turns the API's plan into the frontend model", () => {
    expect(toFloorPlan(plan([zone({ hitPadding: 0, label: { dx: 31, dy: -19 } })]))).toEqual({
      id: "00000000-0000-4000-8000-000000000001",
      name: "Office",
      viewBox: [0, 0, 800, 600],
      pxPerMeter: 32,
      background: "demo-office",
      zones: [
        {
          id: "00000000-0000-4000-8000-000000000101",
          type: "reception",
          shape: { kind: "rect", x: 1, y: 2, width: 3, height: 4, rx: 5 },
          color: "#C9962A",
          zIndex: 1,
          hitPadding: 0,
          label: { dx: 31, dy: -19 },
          content: { en: content, ru: { ...content, name: "Ресепшен" } },
        },
      ],
    });
  });

  it("leaves out fields the API sends as null, so the frontend defaults apply", () => {
    const [mapped] = toFloorPlan(plan([zone()])).zones;
    expect(mapped).not.toHaveProperty("hitPadding");
    expect(mapped).not.toHaveProperty("label");
    expect(toFloorPlan({ ...plan([]), background: null })).not.toHaveProperty("background");
  });

  it("keeps the zones in the API's order (legend order)", () => {
    const zones = [zone({ id: "b", zIndex: 0 }), zone({ id: "a", zIndex: 5 })];
    expect(toFloorPlan(plan(zones)).zones.map((z) => z.id)).toEqual(["b", "a"]);
  });
});

describe("fetchPlan", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("gets the plan from /api/plans/:id", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json(plan([zone()])));
    vi.stubGlobal("fetch", fetchMock);
    const signal = new AbortController().signal;

    const result = await fetchPlan("00000000-0000-4000-8000-000000000001", signal);

    expect(fetchMock).toHaveBeenCalledWith("/api/plans/00000000-0000-4000-8000-000000000001", {
      method: "GET",
      signal,
    });
    expect(result.zones).toHaveLength(1);
  });

  it("throws an ApiError with the status for an error answer", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 404 })));

    const error = await fetchPlan("00000000-0000-4000-8000-00000000ffff").catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 404 });
  });
});

describe("the endpoint functions", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const json = { "Content-Type": "application/json" };
  const zoneBody = {
    type: "custom" as const,
    shape: { kind: "circle" as const, cx: 1, cy: 2, r: 3 },
    color: "#123456",
    content: { en: content, ru: content },
  };

  it.each([
    ["listPlans", () => listPlans(), "GET", "/api/plans", undefined],
    ["createPlan", () => createPlan({ name: "A", viewBox: [0, 0, 800, 600], pxPerMeter: 32 }), "POST", "/api/plans",
      { name: "A", viewBox: [0, 0, 800, 600], pxPerMeter: 32 }],
    ["updatePlan", () => updatePlan("p1", { version: 2, name: "B" }), "PATCH", "/api/plans/p1", { version: 2, name: "B" }],
    ["deletePlan", () => deletePlan("p1"), "DELETE", "/api/plans/p1", undefined],
    ["createZone", () => createZone("p1", zoneBody), "POST", "/api/plans/p1/zones", zoneBody],
    ["updateZone", () => updateZone("z1", { version: 3, color: "#654321" }), "PATCH", "/api/zones/z1",
      { version: 3, color: "#654321" }],
    ["deleteZone", () => deleteZone("z1"), "DELETE", "/api/zones/z1", undefined],
  ])("%s sends %s %s", async (_, call, method, url, body) => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);

    await call();

    expect(fetchMock).toHaveBeenCalledWith(
      url,
      body === undefined ? { method, signal: undefined } : { method, signal: undefined, headers: json, body: JSON.stringify(body) },
    );
  });
});

describe("shouldRetry", () => {
  it("does not retry a 4xx answer", () => {
    expect(shouldRetry(0, new ApiError(404, "not found"))).toBe(false);
  });

  it("retries a 5xx answer or a network error once", () => {
    expect(shouldRetry(0, new ApiError(503, "down"))).toBe(true);
    expect(shouldRetry(0, new TypeError("Failed to fetch"))).toBe(true);
    expect(shouldRetry(1, new TypeError("Failed to fetch"))).toBe(false);
  });
});
