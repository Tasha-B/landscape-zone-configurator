// Test support for the editor's component tests: the API in memory, checking
// versions like the real one, and the editor rendered on its route
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { vi } from "vitest";
import type { PlanResponse, ZoneResponse } from "../../lib/api/types";
import { LanguageProvider } from "../../lib/i18n/LanguageProvider";
import PlanEditorPage from "../../pages/PlanEditorPage";

export const PLAN = "00000000-0000-4000-8000-0000000000aa";

const content = (name: string) => ({
  en: { name, tagline: "t", recommendation: "r", rationale: "w" },
  ru: { name: `${name} (ru)`, tagline: "т", recommendation: "р", rationale: "п" },
});

function zone(id: string, name: string, shape: ZoneResponse["shape"], zIndex: number): ZoneResponse {
  return { id, type: "custom", shape, color: "#4A7C59", zIndex, hitPadding: null, label: null, version: 1, content: content(name) };
}

export interface Write {
  method: string;
  url: string;
  body?: Record<string, unknown>;
}

// `failNext` answers the next write with that status
export function fakeEditorApi() {
  const api = {
    plan: {
      id: PLAN,
      name: "Second floor",
      viewBox: [0, 0, 800, 600],
      pxPerMeter: 32,
      background: null,
      version: 1,
      zones: [
        zone("a", "Reception", { kind: "rect", x: 100, y: 100, width: 200, height: 100, rx: 4 }, 1),
        zone("b", "Lounge", { kind: "circle", cx: 600, cy: 300, r: 50 }, 2),
        zone("c", "Bay", { kind: "polygon", points: [[400, 400], [500, 400], [450, 500]] }, 3),
      ],
    } as PlanResponse,
    writes: [] as Write[],
    failNext: null as number | null,
    gets: 0,
    // The bodies of zone PATCHes, in order
    get patches() {
      return api.writes.filter((write) => write.method === "PATCH" && write.url.startsWith("/api/zones/")).map((write) => write.body!);
    },
  };
  const conflict = () => Response.json({ statusCode: 409, message: "changed" }, { status: 409 });

  vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
    const method = init.method ?? "GET";
    if (method === "GET") {
      api.gets++;
      return url === `/api/plans/${PLAN}`
        ? Response.json(api.plan)
        : Response.json({ statusCode: 404, message: "Plan not found" }, { status: 404 });
    }
    const body = init.body ? (JSON.parse(init.body as string) as Record<string, unknown>) : undefined;
    api.writes.push({ method, url, body });
    if (api.failNext) {
      const status = api.failNext;
      api.failNext = null;
      return Response.json({ statusCode: status, message: "failed" }, { status });
    }
    const zoneId = url.match(/^\/api\/zones\/(.+)$/)?.[1];
    if (method === "PATCH" && zoneId) {
      const current = api.plan.zones.find((item) => item.id === zoneId)!;
      if (body!.version !== current.version) return conflict();
      const { version: _, content: changedContent, ...fields } = body!;
      const next = {
        ...current,
        ...fields,
        content: { ...current.content, ...(changedContent as object) },
        version: current.version + 1,
      } as ZoneResponse;
      api.plan = { ...api.plan, zones: api.plan.zones.map((item) => (item.id === zoneId ? next : item)) };
      return Response.json(next);
    }
    if (method === "DELETE" && zoneId) {
      api.plan = { ...api.plan, zones: api.plan.zones.filter((item) => item.id !== zoneId) };
      return new Response(null, { status: 204 });
    }
    if (method === "POST" && url === `/api/plans/${PLAN}/zones`) {
      const created = {
        id: `new-${api.writes.length}`,
        zIndex: 9,
        hitPadding: null,
        label: null,
        version: 1,
        ...body,
      } as ZoneResponse;
      api.plan = { ...api.plan, zones: [...api.plan.zones, created] };
      return Response.json(created, { status: 201 });
    }
    if (method === "PATCH" && url === `/api/plans/${PLAN}`) {
      if (body!.version !== api.plan.version) return conflict();
      const { version: _, ...fields } = body!;
      api.plan = { ...api.plan, ...fields, version: api.plan.version + 1 } as PlanResponse;
      return Response.json(api.plan);
    }
    throw new Error(`Unexpected ${method} ${url}`);
  });
  return api;
}

export function renderEditor(id = PLAN) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <LanguageProvider>
        <MemoryRouter initialEntries={[`/plans/${id}/edit`]}>
          <Routes>
            <Route path="/plans/:id/edit" element={<PlanEditorPage />} />
          </Routes>
        </MemoryRouter>
      </LanguageProvider>
    </QueryClientProvider>,
  );
}
