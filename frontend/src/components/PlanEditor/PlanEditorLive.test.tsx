// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { notifyManager } from "@tanstack/react-query";
import { act, cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sockets } from "../../lib/api/fakeSocket";
import type { ZoneResponse } from "../../lib/api/types";
import { fakeEditorApi, PLAN, receive, renderEditor } from "./fakeEditorApi";

vi.mock("socket.io-client", () => import("../../lib/api/fakeSocket"));

describe("the editor under other viewers' changes", () => {
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
  const rectOf = (name: string) => zoneButton(name).querySelector("rect")!;
  const select = (name: string) => {
    fireEvent.pointerDown(zoneButton(name), { button: 0, clientX: 1, clientY: 1, pointerId: 1 });
    fireEvent.pointerUp(zoneButton(name), { button: 0, clientX: 1, clientY: 1, pointerId: 1 });
  };
  const status = () => screen.getByRole("status");
  const serverZone = (id: string) => api.plan.zones.find((zone) => zone.id === id)!;
  const tick = () => act(async () => new Promise((resolve) => setTimeout(resolve, 0)));

  // Another viewer's saved change: on the server, and its event here
  async function changedElsewhere(id: string, changes: Partial<ZoneResponse>) {
    const zone = { ...serverZone(id), ...changes, version: serverZone(id).version + 1 };
    api.plan = { ...api.plan, zones: api.plan.zones.map((item) => (item.id === id ? zone : item)) };
    await receive("zone.updated", { planId: PLAN, zone });
  }

  async function deletedElsewhere(id: string) {
    api.plan = { ...api.plan, zones: api.plan.zones.filter((zone) => zone.id !== id) };
    await receive("zone.deleted", { planId: PLAN, zoneId: id });
  }

  const renamed = (id: string, name: string) => ({
    content: { ...serverZone(id).content, en: { ...serverZone(id).content.en, name } },
  });

  describe("on the canvas", () => {
    it("shows another viewer's change", async () => {
      renderEditor();
      await loaded();

      await changedElsewhere("a", renamed("a", "Front desk"));

      expect(zoneButton("Front desk")).toBeInTheDocument();
      expect(api.writes).toEqual([]);
    });

    it("keeps a change being saved on top, and both survive", async () => {
      renderEditor();
      await loaded();
      api.hold();

      fireEvent.keyDown(zoneButton("Reception"), { key: "ArrowRight" });
      await waitFor(() => expect(serverZone("a").version).toBe(2));
      await changedElsewhere("a", { color: "#123456" });

      expect(rectOf("Reception")).toHaveAttribute("x", "101");
      expect(rectOf("Reception")).toHaveAttribute("stroke", "#123456");

      api.release();
      await waitFor(() => expect(status()).toHaveTextContent("All changes saved"));
      expect(rectOf("Reception")).toHaveAttribute("x", "101");
      expect(rectOf("Reception")).toHaveAttribute("stroke", "#123456");
    });

    it("sends the next change with the version that came through the event", async () => {
      renderEditor();
      await loaded();
      await changedElsewhere("a", { color: "#123456" });

      fireEvent.keyDown(zoneButton("Reception"), { key: "ArrowRight" });

      await waitFor(() => expect(api.patches).toHaveLength(1));
      expect(api.patches[0].version).toBe(2);
      await waitFor(() => expect(status()).toHaveTextContent("All changes saved"));
    });

    it("keeps a dragged zone under the pointer, and the release saves it", async () => {
      renderEditor();
      await loaded();
      const rect = rectOf("Reception");
      fireEvent.pointerDown(rect, { button: 0, clientX: 150, clientY: 150, pointerId: 1 });
      fireEvent.pointerMove(rect, { clientX: 170, clientY: 150, pointerId: 1 });

      await changedElsewhere("a", { color: "#123456", shape: { kind: "rect", x: 0, y: 0, width: 50, height: 50, rx: 0 } });
      expect(rectOf("Reception")).toHaveAttribute("x", "120");

      fireEvent.pointerUp(rectOf("Reception"), { clientX: 170, clientY: 150, pointerId: 1 });
      await waitFor(() => expect(api.patches).toHaveLength(1));
      expect(api.patches[0]).toMatchObject({ version: 2, shape: { x: 120 } });
    });

    it("sends nothing for a drag whose zone was deleted meanwhile", async () => {
      renderEditor();
      await loaded();
      const rect = rectOf("Reception");
      fireEvent.pointerDown(rect, { button: 0, clientX: 150, clientY: 150, pointerId: 1 });
      fireEvent.pointerMove(rect, { clientX: 170, clientY: 150, pointerId: 1 });

      await deletedElsewhere("a");
      fireEvent.pointerUp(screen.getByRole("group", { name: "Plan “Second floor”" }), {
        clientX: 170,
        clientY: 150,
        pointerId: 1,
      });

      await tick();
      expect(api.writes).toEqual([]);
      expect(status()).not.toHaveTextContent("Could not save");
    });
  });

  describe("in a field", () => {
    const nameField = () => screen.getByLabelText("Name") as HTMLInputElement;

    it("keeps what is being typed, and leaving the field saves it", async () => {
      const user = userEvent.setup();
      renderEditor();
      await loaded();
      select("Reception");
      await user.clear(nameField());
      await user.type(nameField(), "Typed");

      await changedElsewhere("a", renamed("a", "From elsewhere"));
      expect(nameField()).toHaveValue("Typed");

      await user.tab();
      await waitFor(() => expect(api.patches).toHaveLength(1));
      expect(api.patches[0]).toMatchObject({ version: 2, content: { en: { name: "Typed" } } });
    });

    it("follows the saved value when focused but untouched, and saves nothing", async () => {
      const user = userEvent.setup();
      renderEditor();
      await loaded();
      select("Reception");
      await user.click(nameField());

      await changedElsewhere("a", renamed("a", "From elsewhere"));
      expect(nameField()).toHaveValue("From elsewhere");

      await user.tab();
      await tick();
      expect(api.patches).toEqual([]);
      expect(serverZone("a").content.en.name).toBe("From elsewhere");
    });

    it("keeps a message about an empty field when the saved value changes", async () => {
      const user = userEvent.setup();
      renderEditor();
      await loaded();
      select("Reception");
      await user.clear(nameField());
      await user.tab();
      expect(screen.getByText("Fill this in")).toBeInTheDocument();

      await changedElsewhere("a", renamed("a", "From elsewhere"));

      expect(nameField()).toHaveValue("");
      expect(screen.getByText("Fill this in")).toBeInTheDocument();
    });

    it("shows the old text again when a typed text could not be saved", async () => {
      const user = userEvent.setup();
      renderEditor();
      await loaded();
      select("Reception");
      await user.clear(nameField());
      await user.type(nameField(), "Typed");
      api.failNext = 500;

      await user.tab();

      await waitFor(() => expect(status()).toHaveTextContent("Could not save"));
      await waitFor(() => expect(nameField()).toHaveValue("Reception"));
    });

    it("follows a plan changed elsewhere", async () => {
      renderEditor();
      await loaded();
      const { zones: _zones, ...fields } = api.plan;

      await receive("plan.updated", { planId: PLAN, plan: { ...fields, name: "Third floor", version: 2 } });

      expect(screen.getByRole("heading", { level: 1, name: "Third floor" })).toBeInTheDocument();
      expect(screen.getByDisplayValue("Third floor")).toBeInTheDocument();
    });
  });

  describe("a selected zone deleted elsewhere", () => {
    it("clears the selection, says so and shows the plan's panel", async () => {
      renderEditor();
      await loaded();
      select("Reception");

      await deletedElsewhere("a");

      expect(status()).toHaveTextContent("This zone was deleted elsewhere.");
      expect(screen.getByDisplayValue("Second floor")).toBeInTheDocument();
      expect(document.querySelectorAll("[data-handle]")).toHaveLength(0);
    });

    it("moves a focus that went with it to the toolbar", async () => {
      renderEditor();
      await loaded();
      select("Reception");
      expect(zoneButton("Reception")).toHaveFocus();

      await deletedElsewhere("a");

      expect(screen.getByRole("button", { name: "+ Rectangle" })).toHaveFocus();
    });

    it("leaves a focus that is elsewhere alone", async () => {
      renderEditor();
      await loaded();
      select("Reception");
      zoneButton("Lounge").focus();

      await deletedElsewhere("a");

      expect(zoneButton("Lounge")).toHaveFocus();
    });

    it("closes a delete confirmation, which does not come back", async () => {
      const user = userEvent.setup();
      renderEditor();
      await loaded();
      select("Reception");
      await user.click(screen.getByRole("button", { name: "Delete zone" }));
      const asking = screen.getByRole("group", { name: "Delete zone" });
      expect(within(asking).getAllByRole("button").at(-1)).toHaveFocus();

      await deletedElsewhere("a");
      expect(screen.queryByRole("group", { name: "Delete zone" })).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "+ Rectangle" })).toHaveFocus();

      select("Lounge");
      expect(screen.queryByRole("group", { name: "Delete zone" })).not.toBeInTheDocument();
      expect(api.writes).toEqual([]);
    });

    it("puts the focus on the toolbar's Tab stop after Cancel and after deleting", async () => {
      const user = userEvent.setup();
      renderEditor();
      await loaded();
      select("Reception");

      await user.click(screen.getByRole("button", { name: "Delete zone" }));
      await user.keyboard("{Enter}");
      expect(screen.getByRole("button", { name: "Delete zone" })).toHaveFocus();
      expect(api.writes).toEqual([]);

      await user.click(screen.getByRole("button", { name: "Delete zone" }));
      const asking = screen.getByRole("group", { name: "Delete zone" });
      await user.click(within(asking).getAllByRole("button")[0]);
      expect(screen.getByRole("button", { name: "+ Rectangle" })).toHaveFocus();
      await waitFor(() => expect(status()).toHaveTextContent("All changes saved"));
      expect(api.writes.map((write) => write.method)).toEqual(["DELETE"]);
    });

    it("does not take the focus when the editor opens", async () => {
      renderEditor();
      await loaded();
      expect(document.body).toHaveFocus();
    });

    it("does not take a new zone for a deleted one while the plan has yet to show it", async () => {
      const user = userEvent.setup();
      renderEditor();
      await loaded();
      // The plan hears of the new zone after the selection does, as in a browser
      notifyManager.setScheduler((callback) => void setTimeout(callback, 20));
      try {
        await user.click(screen.getByRole("button", { name: "+ Rectangle" }));

        expect(await screen.findByRole("heading", { name: "Zone: New zone" })).toBeInTheDocument();
        expect(status()).not.toHaveTextContent("deleted elsewhere");
      } finally {
        notifyManager.setScheduler((callback) => void setTimeout(callback, 0));
      }
    });

    it("clears the message with the next change", async () => {
      renderEditor();
      await loaded();
      select("Reception");
      await deletedElsewhere("a");

      fireEvent.keyDown(zoneButton("Lounge"), { key: "ArrowRight" });

      await waitFor(() => expect(status()).toHaveTextContent("All changes saved"));
    });

    it("says nothing about another zone, or about this editor's own delete", async () => {
      const user = userEvent.setup();
      renderEditor();
      await loaded();
      select("Reception");

      await deletedElsewhere("b");
      expect(status()).toHaveTextContent("");
      expect(zoneButton("Reception")).toHaveAttribute("aria-pressed", "true");

      await user.click(screen.getByRole("button", { name: "Delete zone" }));
      const asking = screen.getByRole("group", { name: "Delete zone" });
      await user.click(within(asking).getAllByRole("button")[0]);
      await waitFor(() => expect(status()).toHaveTextContent("All changes saved"));
    });
  });

  describe("a plan deleted elsewhere", () => {
    const NOT_FOUND = "This plan does not exist. It may have been deleted.";

    it("shows not found after the event", async () => {
      renderEditor();
      await loaded();
      api.gone = true;

      await receive("plan.deleted", { planId: PLAN });

      expect(await screen.findByText(NOT_FOUND)).toBeInTheDocument();
    });

    it("shows not found when only a reload finds out, not a lost connection", async () => {
      renderEditor();
      await loaded();
      api.gone = true;

      await receive("connect");
      await act(async () => sockets.at(-1)!.answerJoin());

      expect(await screen.findByText(NOT_FOUND)).toBeInTheDocument();
      expect(screen.queryByText(/No connection/)).not.toBeInTheDocument();
    });
  });

  describe("the connection", () => {
    const PAUSED = "Live updates are paused. Reconnecting…";

    async function joined() {
      await receive("connect");
      await act(async () => sockets.at(-1)!.answerJoin());
    }

    it("says nothing while connecting and while live", async () => {
      renderEditor();
      await loaded();
      expect(status()).toHaveTextContent("");
      await joined();
      expect(status()).toHaveTextContent("");
    });

    it("says live updates are paused until the connection returns", async () => {
      renderEditor();
      await loaded();
      await joined();

      await receive("disconnect");
      expect(status()).toHaveTextContent(PAUSED);

      await joined();
      expect(status()).not.toHaveTextContent(PAUSED);
    });

    it("says it after a saved change as well", async () => {
      renderEditor();
      await loaded();
      fireEvent.keyDown(zoneButton("Reception"), { key: "ArrowRight" });
      await waitFor(() => expect(status()).toHaveTextContent("All changes saved"));

      await receive("disconnect");

      expect(status()).toHaveTextContent(PAUSED);
    });

    it("comes before a message about something past, which returns with the connection", async () => {
      renderEditor();
      await loaded();
      select("Reception");
      await deletedElsewhere("a");

      await receive("disconnect");
      expect(status()).toHaveTextContent(PAUSED);

      await joined();
      expect(status()).toHaveTextContent("This zone was deleted elsewhere.");
    });

    it("gives way to a lost server", async () => {
      renderEditor();
      await loaded();
      await joined();
      await receive("disconnect");
      expect(status()).toHaveTextContent(PAUSED);

      api.down = true;
      await joined();

      await waitFor(() => expect(status()).toHaveTextContent(/No connection to the server/));
    });
  });
});
