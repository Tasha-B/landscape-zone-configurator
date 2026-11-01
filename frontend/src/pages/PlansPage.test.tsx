// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useParams } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PLAN_ID } from "../config";
import type { PlanSummary } from "../lib/api/types";
import { LanguageProvider } from "../lib/i18n/LanguageProvider";
import PlansPage from "./PlansPage";

// The API's plan list in memory. `failList` answers GET /api/plans with 500.
function fakeApi(initial: PlanSummary[]) {
  const api = { plans: initial, requests: [] as string[], bodies: [] as unknown[], failList: false };
  vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
    const method = init.method ?? "GET";
    api.requests.push(`${method} ${url}`);
    if (method === "GET" && url === "/api/plans") {
      return api.failList ? new Response("down", { status: 500 }) : Response.json(api.plans);
    }
    if (method === "POST" && url === "/api/plans") {
      const body = JSON.parse(init.body as string);
      api.bodies.push(body);
      const plan = { id: "00000000-0000-4000-8000-0000000000aa", background: null, version: 1, zones: [], ...body };
      api.plans = [...api.plans, { id: plan.id, name: plan.name, background: null, zoneCount: 0, updatedAt: "2026-11-01T10:00:00Z" }];
      return Response.json(plan, { status: 201 });
    }
    const deleted = url.match(/^\/api\/plans\/(.+)$/)?.[1];
    if (method === "DELETE" && deleted) {
      api.plans = api.plans.filter((plan) => plan.id !== deleted);
      return new Response(null, { status: 204 });
    }
    throw new Error(`Unexpected ${method} ${url}`);
  });
  return api;
}

const summary = (id: string, name: string, zoneCount: number): PlanSummary => ({
  id,
  name,
  background: null,
  zoneCount,
  updatedAt: "2026-10-31T14:27:30Z",
});

function EditorStub() {
  return <p>editor for {useParams().id}</p>;
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <LanguageProvider>
        <MemoryRouter initialEntries={["/plans"]}>
          <Routes>
            <Route path="/plans" element={<PlansPage />} />
            <Route path="/plans/:id/edit" element={<EditorStub />} />
          </Routes>
        </MemoryRouter>
      </LanguageProvider>
    </QueryClientProvider>,
  );
}

describe("the plans page", () => {
  let api: ReturnType<typeof fakeApi>;
  const other = "00000000-0000-4000-8000-000000000002";

  beforeEach(() => {
    api = fakeApi([summary(PLAN_ID, "Cairn Botanics office", 5), summary(other, "Second floor", 1)]);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  const rows = async () => within(await screen.findByRole("list", { name: "All plans" })).getAllByRole("listitem");

  it("lists the plans with their zones and last change, and links each to its editor", async () => {
    renderPage();
    const [demo, second] = await rows();

    expect(demo).toHaveTextContent("Cairn Botanics office");
    expect(demo).toHaveTextContent("5 zones · changed Oct 31, 2026");
    expect(demo).toHaveTextContent("on the showcase");
    expect(second).toHaveTextContent("1 zone ·");
    expect(second).not.toHaveTextContent("on the showcase");
    expect(within(second).getByRole("link", { name: "Edit" })).toHaveAttribute("href", `/plans/${other}/edit`);
    expect(within(second).getByRole("link", { name: "Second floor" })).toHaveAttribute("href", `/plans/${other}/edit`);
  });

  it("says so when there are no plans", async () => {
    api.plans = [];
    renderPage();
    expect(await screen.findByText("No plans yet. Create the first one above.")).toBeInTheDocument();
  });

  it("creates a plan with the default sheet and opens it in the editor", async () => {
    const user = userEvent.setup();
    renderPage();
    await rows();

    await user.type(screen.getByLabelText("Name of the new plan"), "  Third floor ");
    await user.click(screen.getByRole("button", { name: "Create plan" }));

    expect(await screen.findByText("editor for 00000000-0000-4000-8000-0000000000aa")).toBeInTheDocument();
    expect(api.bodies).toEqual([{ name: "Third floor", viewBox: [0, 0, 800, 600], pxPerMeter: 32 }]);
  });

  it("does not send a blank name", async () => {
    const user = userEvent.setup();
    renderPage();
    await rows();

    await user.type(screen.getByLabelText("Name of the new plan"), "   ");
    await user.click(screen.getByRole("button", { name: "Create plan" }));

    expect(api.requests.filter((request) => request.startsWith("POST"))).toEqual([]);
  });

  it("asks before deleting, and Cancel keeps the plan", async () => {
    const user = userEvent.setup();
    renderPage();
    const second = (await rows())[1];

    await user.click(within(second).getByRole("button", { name: "Delete" }));
    expect(second).toHaveTextContent("Delete “Second floor” with all its zones? This cannot be undone.");
    expect(within(second).getByRole("button", { name: "Cancel" })).toHaveFocus();

    await user.click(within(second).getByRole("button", { name: "Cancel" }));
    expect(within(second).getByRole("button", { name: "Delete" })).toBeInTheDocument();
    expect(api.requests.filter((request) => request.startsWith("DELETE"))).toEqual([]);
  });

  it("deletes a plan after confirmation and refreshes the list", async () => {
    const user = userEvent.setup();
    renderPage();
    const second = (await rows())[1];

    await user.click(within(second).getByRole("button", { name: "Delete" }));
    await user.click(within(second).getByRole("button", { name: "Delete for good" }));

    await waitFor(async () => expect(await rows()).toHaveLength(1));
    expect(api.requests).toContain(`DELETE /api/plans/${other}`);
  });

  it("shows an error with a retry when the list cannot be loaded", async () => {
    const user = userEvent.setup();
    api.failList = true;
    renderPage();

    expect(await screen.findByRole("alert")).toHaveTextContent("The plans could not be loaded");
    api.failList = false;
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(await rows()).toHaveLength(2);
  });
});
