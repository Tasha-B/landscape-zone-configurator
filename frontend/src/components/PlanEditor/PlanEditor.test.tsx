// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fakeEditorApi, renderEditor } from "./fakeEditorApi";

describe("the plan editor", () => {
  let api: ReturnType<typeof fakeEditorApi>;

  beforeEach(() => {
    api = fakeEditorApi();
    // The SVG is laid out 1:1 with its 800 × 600 viewBox (jsdom has no layout)
    vi.spyOn(SVGElement.prototype, "getBoundingClientRect").mockReturnValue(
      { left: 0, top: 0, width: 800, height: 600, x: 0, y: 0, right: 800, bottom: 600 } as DOMRect,
    );
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  const canvas = () => screen.findByRole("group", { name: "Plan “Second floor”" });
  const zoneButton = (name: string) => screen.getByRole("button", { name });
  const rectOf = (name: string) => zoneButton(name).querySelector("rect")!;
  const handles = () => document.querySelectorAll("[data-handle]");

  it("shows the plan's zones as buttons, in paint order", async () => {
    renderEditor();
    const svg = await canvas();
    expect(within(svg).getAllByRole("button").map((button) => button.getAttribute("aria-label"))).toEqual([
      "Reception",
      "Lounge",
      "Bay",
    ]);
    expect(screen.getByRole("heading", { name: "Second floor" })).toBeInTheDocument();
  });

  it("selects a zone with a click, shows its handles, and Esc clears the selection", async () => {
    renderEditor();
    await canvas();

    fireEvent.pointerDown(zoneButton("Reception"), { button: 0, clientX: 150, clientY: 150, pointerId: 1 });
    fireEvent.pointerUp(zoneButton("Reception"), { button: 0, clientX: 150, clientY: 150, pointerId: 1 });
    expect(zoneButton("Reception")).toHaveAttribute("aria-pressed", "true");
    expect(handles()).toHaveLength(8);

    fireEvent.pointerDown(zoneButton("Lounge"), { button: 0, clientX: 600, clientY: 300, pointerId: 1 });
    fireEvent.pointerUp(zoneButton("Lounge"), { button: 0, clientX: 600, clientY: 300, pointerId: 1 });
    expect(handles()).toHaveLength(1);

    fireEvent.keyDown(zoneButton("Lounge"), { key: "Escape" });
    expect(zoneButton("Lounge")).toHaveAttribute("aria-pressed", "false");
    expect(handles()).toHaveLength(0);
    // A click without a move saves nothing
    expect(api.patches).toEqual([]);
  });

  it("moves a dragged zone and saves it on release", async () => {
    renderEditor();
    const svg = await canvas();

    fireEvent.pointerDown(zoneButton("Reception"), { button: 0, clientX: 150, clientY: 150, pointerId: 1 });
    fireEvent.pointerMove(svg, { clientX: 180.4, clientY: 120, pointerId: 1 });
    expect(rectOf("Reception")).toHaveAttribute("x", "130");
    expect(api.patches).toEqual([]);
    fireEvent.pointerUp(svg, { clientX: 200, clientY: 130, pointerId: 1 });

    await waitFor(() => expect(api.patches).toHaveLength(1));
    expect(api.patches[0]).toEqual({ version: 1, shape: { kind: "rect", x: 150, y: 80, width: 200, height: 100, rx: 4 } });
    // The zone stays where it was dropped
    expect(rectOf("Reception")).toHaveAttribute("x", "150");
    await waitFor(() => expect(api.plan.zones[0].version).toBe(2));
    expect(rectOf("Reception")).toHaveAttribute("x", "150");
  });

  it("resizes with a handle and keeps the zone on the sheet", async () => {
    renderEditor();
    const svg = await canvas();
    fireEvent.pointerDown(zoneButton("Reception"), { button: 0, clientX: 150, clientY: 150, pointerId: 1 });
    fireEvent.pointerUp(svg, { clientX: 150, clientY: 150, pointerId: 1 });

    const corner = document.querySelector('[data-handle="se"]')!;
    fireEvent.pointerDown(corner, { button: 0, clientX: 300, clientY: 200, pointerId: 2 });
    fireEvent.pointerMove(svg, { clientX: 900, clientY: 260, pointerId: 2 });
    fireEvent.pointerUp(svg, { clientX: 900, clientY: 260, pointerId: 2 });

    await waitFor(() => expect(api.patches).toHaveLength(1));
    expect(api.patches[0].shape).toEqual({ kind: "rect", x: 100, y: 100, width: 700, height: 160, rx: 4 });
  });

  it("drags a polygon's vertex", async () => {
    renderEditor();
    const svg = await canvas();
    fireEvent.pointerDown(zoneButton("Bay"), { button: 0, clientX: 450, clientY: 430, pointerId: 1 });
    fireEvent.pointerUp(svg, { clientX: 450, clientY: 430, pointerId: 1 });
    expect(handles()).toHaveLength(3);

    fireEvent.pointerDown(document.querySelector('[data-handle="2"]')!, { button: 0, clientX: 450, clientY: 500, pointerId: 2 });
    fireEvent.pointerMove(svg, { clientX: 470, clientY: 560, pointerId: 2 });
    fireEvent.pointerUp(svg, { clientX: 470, clientY: 560, pointerId: 2 });

    await waitFor(() => expect(api.patches).toHaveLength(1));
    expect(api.patches[0].shape).toEqual({ kind: "polygon", points: [[400, 400], [500, 400], [470, 560]] });
  });

  it("moves the focused zone with the arrow keys, each press saved in turn", async () => {
    const user = userEvent.setup();
    renderEditor();
    await canvas();

    zoneButton("Lounge").focus();
    await user.keyboard("{ArrowRight}{ArrowRight}{Shift>}{ArrowUp}{/Shift}");

    expect(zoneButton("Lounge")).toHaveAttribute("aria-pressed", "true");
    await waitFor(() => expect(api.patches).toHaveLength(3));
    expect(api.patches).toEqual([
      { version: 1, shape: { kind: "circle", cx: 601, cy: 300, r: 50 } },
      { version: 2, shape: { kind: "circle", cx: 602, cy: 300, r: 50 } },
      { version: 3, shape: { kind: "circle", cx: 602, cy: 290, r: 50 } },
    ]);
  });

  it("puts a zone back when its change could not be saved", async () => {
    renderEditor();
    const svg = await canvas();
    api.failNext = 500;

    fireEvent.pointerDown(zoneButton("Reception"), { button: 0, clientX: 150, clientY: 150, pointerId: 1 });
    fireEvent.pointerMove(svg, { clientX: 250, clientY: 150, pointerId: 1 });
    fireEvent.pointerUp(svg, { clientX: 250, clientY: 150, pointerId: 1 });

    await waitFor(() => expect(api.patches).toHaveLength(1));
    await waitFor(() => expect(rectOf("Reception")).toHaveAttribute("x", "100"));
  });

  it("says when the plan does not exist", async () => {
    renderEditor("00000000-0000-4000-8000-00000000ffff");
    expect(await screen.findByRole("alert")).toHaveTextContent("This plan does not exist");
    expect(screen.getByRole("link", { name: "← Plans" })).toHaveAttribute("href", "/plans");
  });
});
