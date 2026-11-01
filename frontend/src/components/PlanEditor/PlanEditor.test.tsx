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

  it("puts the focus on a zone pressed with the pointer, so the keys go on from it", async () => {
    renderEditor();
    await canvas();
    fireEvent.pointerDown(zoneButton("Lounge"), { button: 0, clientX: 600, clientY: 300, pointerId: 1 });
    expect(zoneButton("Lounge")).toHaveFocus();
  });

  it("adds a polygon vertex from an edge's midpoint, dragged or just clicked", async () => {
    renderEditor();
    const svg = await canvas();
    fireEvent.pointerDown(zoneButton("Bay"), { button: 0, clientX: 450, clientY: 430, pointerId: 1 });
    fireEvent.pointerUp(svg, { clientX: 450, clientY: 430, pointerId: 1 });
    expect(document.querySelectorAll("[data-midpoint]")).toHaveLength(3);

    // The edge from (400, 400) to (500, 400): its middle dragged up
    const first = document.querySelector('[data-midpoint="0"]')!;
    fireEvent.pointerDown(first, { button: 0, clientX: 450, clientY: 400, pointerId: 2 });
    fireEvent.pointerMove(svg, { clientX: 455, clientY: 370, pointerId: 2 });
    fireEvent.pointerUp(svg, { clientX: 455, clientY: 370, pointerId: 2 });
    await waitFor(() => expect(api.patches).toHaveLength(1));
    expect(api.patches[0].shape).toEqual({ kind: "polygon", points: [[400, 400], [455, 370], [500, 400], [450, 500]] });

    // A click on a midpoint adds the vertex where it is
    await waitFor(() => expect(document.querySelectorAll("[data-midpoint]")).toHaveLength(4));
    const last = document.querySelector('[data-midpoint="3"]')!;
    fireEvent.pointerDown(last, { button: 0, clientX: 425, clientY: 450, pointerId: 3 });
    fireEvent.pointerUp(svg, { clientX: 425, clientY: 450, pointerId: 3 });
    await waitFor(() => expect(api.patches).toHaveLength(2));
    expect(api.patches[1]).toMatchObject({
      version: 2,
      shape: { points: [[400, 400], [455, 370], [500, 400], [450, 500], [425, 450]] },
    });
  });

  // Two presses and releases without a move, as a double click with a real
  // pointer arrives (the browser's dblclick does not: see EditorCanvas)
  function clickVertex(index: number, x: number, y: number, svg: HTMLElement) {
    const handle = document.querySelector(`[data-handle="${index}"]`)!;
    fireEvent.pointerDown(handle, { button: 0, clientX: x, clientY: y, pointerId: 9 });
    fireEvent.pointerUp(svg, { clientX: x, clientY: y, pointerId: 9 });
  }

  it("removes a polygon vertex clicked twice in a row, but not below three", async () => {
    renderEditor();
    const svg = await canvas();
    fireEvent.pointerDown(zoneButton("Bay"), { button: 0, clientX: 450, clientY: 430, pointerId: 1 });
    fireEvent.pointerUp(svg, { clientX: 450, clientY: 430, pointerId: 1 });

    // A triangle: nothing to remove
    clickVertex(1, 500, 400, svg);
    clickVertex(1, 500, 400, svg);
    expect(api.patches).toEqual([]);

    const middle = document.querySelector('[data-midpoint="0"]')!;
    fireEvent.pointerDown(middle, { button: 0, clientX: 450, clientY: 400, pointerId: 2 });
    fireEvent.pointerUp(svg, { clientX: 450, clientY: 400, pointerId: 2 });
    await waitFor(() => expect(document.querySelectorAll("[data-handle]")).toHaveLength(4));

    // One click on each of two vertices removes nothing
    clickVertex(2, 500, 400, svg);
    clickVertex(3, 450, 500, svg);
    expect(api.patches).toHaveLength(1);

    clickVertex(3, 450, 500, svg);
    await waitFor(() => expect(api.patches).toHaveLength(2));
    expect(api.patches[1].shape).toEqual({ kind: "polygon", points: [[400, 400], [450, 400], [500, 400]] });
  });

  it("takes a press that moves less than a few pixels for a click, so a shaky double click still removes", async () => {
    renderEditor();
    const svg = await canvas();
    fireEvent.pointerDown(zoneButton("Bay"), { button: 0, clientX: 450, clientY: 430, pointerId: 1 });
    fireEvent.pointerUp(svg, { clientX: 452, clientY: 431, pointerId: 1 });
    // Selecting with a shaky hand does not move the zone
    expect(api.patches).toEqual([]);
    const middle = document.querySelector('[data-midpoint="0"]')!;
    fireEvent.pointerDown(middle, { button: 0, clientX: 450, clientY: 400, pointerId: 2 });
    fireEvent.pointerUp(svg, { clientX: 450, clientY: 400, pointerId: 2 });
    await waitFor(() => expect(document.querySelectorAll("[data-handle]")).toHaveLength(4));

    const handle = () => document.querySelector('[data-handle="3"]')!;
    fireEvent.pointerDown(handle(), { button: 0, clientX: 450, clientY: 500, pointerId: 3 });
    fireEvent.pointerMove(svg, { clientX: 451, clientY: 502, pointerId: 3 });
    fireEvent.pointerUp(svg, { clientX: 451, clientY: 502, pointerId: 3 });
    fireEvent.pointerDown(handle(), { button: 0, clientX: 452, clientY: 501, pointerId: 3 });
    fireEvent.pointerUp(svg, { clientX: 449, clientY: 500, pointerId: 3 });

    await waitFor(() => expect(api.patches).toHaveLength(2));
    expect(api.patches[1].shape).toEqual({ kind: "polygon", points: [[400, 400], [450, 400], [500, 400]] });
  });

  it("moves once the pointer has gone past the threshold, from where it was pressed", async () => {
    renderEditor();
    const svg = await canvas();
    fireEvent.pointerDown(zoneButton("Reception"), { button: 0, clientX: 150, clientY: 150, pointerId: 1 });
    fireEvent.pointerMove(svg, { clientX: 152, clientY: 150, pointerId: 1 });
    expect(zoneButton("Reception").querySelector("rect")).toHaveAttribute("x", "100");
    fireEvent.pointerMove(svg, { clientX: 160, clientY: 150, pointerId: 1 });
    expect(zoneButton("Reception").querySelector("rect")).toHaveAttribute("x", "110");
    // Back within the threshold, it still follows: once moved, always moved
    fireEvent.pointerMove(svg, { clientX: 151, clientY: 150, pointerId: 1 });
    expect(zoneButton("Reception").querySelector("rect")).toHaveAttribute("x", "101");
    fireEvent.pointerUp(svg, { clientX: 151, clientY: 150, pointerId: 1 });
    await waitFor(() => expect(api.patches).toHaveLength(1));
    expect(api.patches[0].shape).toMatchObject({ x: 101, y: 100 });
  });

  it("does not take two slow clicks on a vertex for a double click", async () => {
    renderEditor();
    const svg = await canvas();
    fireEvent.pointerDown(zoneButton("Bay"), { button: 0, clientX: 450, clientY: 430, pointerId: 1 });
    fireEvent.pointerUp(svg, { clientX: 450, clientY: 430, pointerId: 1 });
    const middle = document.querySelector('[data-midpoint="0"]')!;
    fireEvent.pointerDown(middle, { button: 0, clientX: 450, clientY: 400, pointerId: 2 });
    fireEvent.pointerUp(svg, { clientX: 450, clientY: 400, pointerId: 2 });
    await waitFor(() => expect(document.querySelectorAll("[data-handle]")).toHaveLength(4));

    clickVertex(3, 450, 500, svg);
    await new Promise((resolve) => setTimeout(resolve, 450));
    clickVertex(3, 450, 500, svg);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(api.patches).toHaveLength(1);
  });

  it("gives a polygon's vertices double-arrow cursors pointing away from its center", async () => {
    renderEditor();
    const svg = await canvas();
    fireEvent.pointerDown(zoneButton("Bay"), { button: 0, clientX: 450, clientY: 430, pointerId: 1 });
    fireEvent.pointerUp(svg, { clientX: 450, clientY: 430, pointerId: 1 });
    const cursors = [...document.querySelectorAll<SVGElement>("[data-handle]")].map((handle) => handle.style.cursor);
    // Top-left, top-right, bottom of a triangle
    expect(cursors).toEqual(["nwse-resize", "nesw-resize", "ns-resize"]);
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
