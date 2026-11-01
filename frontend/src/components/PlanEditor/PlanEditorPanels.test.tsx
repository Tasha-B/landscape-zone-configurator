// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DRAFT_CONTENT } from "../../lib/editor/newZone";
import { fakeEditorApi, PLAN, renderEditor } from "./fakeEditorApi";

describe("the editor's toolbar and panels", () => {
  let api: ReturnType<typeof fakeEditorApi>;

  beforeEach(() => {
    api = fakeEditorApi();
    vi.spyOn(SVGElement.prototype, "getBoundingClientRect").mockReturnValue(
      { left: 0, top: 0, width: 800, height: 600, x: 0, y: 0, right: 800, bottom: 600 } as DOMRect,
    );
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  const loaded = () => screen.findByRole("heading", { level: 1, name: "Second floor" });
  const zoneButton = (name: string) => screen.getByRole("button", { name });
  const select = (name: string) => {
    fireEvent.pointerDown(zoneButton(name), { button: 0, clientX: 1, clientY: 1, pointerId: 1 });
    fireEvent.pointerUp(zoneButton(name), { button: 0, clientX: 1, clientY: 1, pointerId: 1 });
  };
  const status = () => screen.getByRole("status");
  const writes = (method: string) => api.writes.filter((write) => write.method === method);

  it("adds each kind of zone in the middle of the sheet, selected, in the next free color", async () => {
    const user = userEvent.setup();
    renderEditor();
    await loaded();

    await user.click(screen.getByRole("button", { name: "+ Rectangle" }));
    expect(await screen.findByRole("heading", { name: "Zone: New zone" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "+ Circle" }));
    await user.click(screen.getByRole("button", { name: "+ Polygon" }));
    await waitFor(() => expect(writes("POST")).toHaveLength(3));

    const bodies = writes("POST").map((write) => write.body!);
    expect(bodies.map((body) => (body.shape as { kind: string }).kind)).toEqual(["rect", "circle", "polygon"]);
    expect(bodies.map((body) => body.color)).toEqual(["#C9962A", "#7A9A5B", "#5FA88C"]);
    expect(bodies[0]).toMatchObject({ type: "custom", content: DRAFT_CONTENT });
    expect(writes("POST")[0].url).toBe(`/api/plans/${PLAN}/zones`);
    // The last one added is selected
    await waitFor(() => expect(screen.getAllByRole("button", { name: "New zone" }).at(-1)).toHaveAttribute("aria-pressed", "true"));
    expect(status()).toHaveTextContent("All changes saved");
  });

  it("deletes the selected zone after asking, and Cancel keeps it", async () => {
    const user = userEvent.setup();
    renderEditor();
    await loaded();
    expect(screen.getByRole("button", { name: "Delete zone" })).toBeDisabled();

    select("Lounge");
    await user.click(screen.getByRole("button", { name: "Delete zone" }));
    expect(screen.getByText("Delete “Lounge”? This cannot be undone.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(writes("DELETE")).toEqual([]);

    await user.click(screen.getByRole("button", { name: "Delete zone" }));
    await user.click(screen.getByRole("button", { name: "Delete for good" }));
    expect(screen.queryByRole("button", { name: "Lounge" })).not.toBeInTheDocument();
    await waitFor(() => expect(writes("DELETE").map((write) => write.url)).toEqual(["/api/zones/b"]));
    // Nothing selected: the panel is the plan's again
    expect(screen.getByRole("heading", { name: "Plan" })).toBeInTheDocument();
  });

  it("asks before deleting when Delete is pressed on a zone", async () => {
    const user = userEvent.setup();
    renderEditor();
    await loaded();

    zoneButton("Bay").focus();
    await user.keyboard("{Delete}");
    expect(screen.getByText("Delete “Bay”? This cannot be undone.")).toBeInTheDocument();
    expect(writes("DELETE")).toEqual([]);
  });

  it("saves a zone's text when the field is left, with its whole language", async () => {
    const user = userEvent.setup();
    renderEditor();
    await loaded();
    select("Reception");

    const name = within(screen.getByRole("group", { name: "Russian" })).getByLabelText("Name");
    await user.clear(name);
    await user.type(name, "  Приёмная ");
    expect(api.patches).toEqual([]);
    await user.tab();

    await waitFor(() => expect(api.patches).toHaveLength(1));
    expect(api.patches[0]).toEqual({
      version: 1,
      content: { ru: { name: "Приёмная", tagline: "т", recommendation: "р", rationale: "п" } },
    });
    expect(name).toHaveValue("Приёмная");
  });

  it("does not send an empty text and says why", async () => {
    const user = userEvent.setup();
    renderEditor();
    await loaded();
    select("Reception");

    const tagline = within(screen.getByRole("group", { name: "English" })).getByLabelText("Tagline");
    await user.clear(tagline);
    await user.tab();

    expect(tagline).toHaveAttribute("aria-invalid", "true");
    expect(tagline).toHaveAccessibleDescription("Fill this in");
    expect(api.patches).toEqual([]);
  });

  it("changes a zone's type and color", async () => {
    const user = userEvent.setup();
    renderEditor();
    await loaded();
    select("Reception");

    await user.selectOptions(screen.getByLabelText("Type"), "Break room");
    await user.click(screen.getByRole("button", { name: "#5FA88C" }));
    const hex = screen.getByLabelText("#rrggbb");
    await user.clear(hex);
    await user.type(hex, "red{Enter}");
    expect(hex).toHaveAccessibleDescription("Use the form #rrggbb");
    await user.clear(hex);
    await user.type(hex, "#abcdef{Enter}");

    await waitFor(() => expect(api.patches).toHaveLength(3));
    expect(api.patches).toEqual([
      { version: 1, type: "break-room" },
      { version: 2, color: "#5FA88C" },
      { version: 3, color: "#ABCDEF" },
    ]);
  });

  it("edits the plan while no zone is selected", async () => {
    const user = userEvent.setup();
    renderEditor();
    await loaded();

    const name = screen.getByLabelText("Name");
    await user.clear(name);
    await user.type(name, "Ground floor{Enter}");
    expect(await screen.findByRole("heading", { level: 1, name: "Ground floor" })).toBeInTheDocument();

    await user.clear(screen.getByLabelText("Width"));
    await user.type(screen.getByLabelText("Width"), "1000{Enter}");
    await user.clear(screen.getByLabelText("Units per meter"));
    await user.type(screen.getByLabelText("Units per meter"), "0{Enter}");
    expect(screen.getByLabelText("Units per meter")).toHaveAccessibleDescription("A number above 0");
    await user.selectOptions(screen.getByLabelText("Background"), "Demo office artwork");

    const planPatches = () => writes("PATCH").filter((write) => write.url === `/api/plans/${PLAN}`).map((write) => write.body);
    await waitFor(() => expect(planPatches()).toHaveLength(3));
    expect(planPatches()).toEqual([
      { version: 1, name: "Ground floor" },
      { version: 2, viewBox: [0, 0, 1000, 600] },
      { version: 3, background: "demo-office" },
    ]);
  });

  it("says when a change was undone, and when the plan was changed elsewhere", async () => {
    const user = userEvent.setup();
    renderEditor();
    await loaded();
    select("Reception");

    api.failNext = 500;
    await user.selectOptions(screen.getByLabelText("Type"), "Break room");
    await waitFor(() => expect(status()).toHaveTextContent("Could not save. The change was undone."));
    expect(screen.getByLabelText("Type")).toHaveValue("custom");

    // Changed meanwhile in another tab
    api.plan = { ...api.plan, zones: api.plan.zones.map((zone) => (zone.id === "a" ? { ...zone, color: "#333333", version: 5 } : zone)) };
    await user.selectOptions(screen.getByLabelText("Type"), "Reception");
    await waitFor(() => expect(status()).toHaveTextContent("This plan was changed elsewhere and has been reloaded."));
    await waitFor(() => expect(screen.getByLabelText("#rrggbb")).toHaveValue("#333333"));
  });
});
