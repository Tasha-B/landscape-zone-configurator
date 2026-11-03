import { describe, expect, it } from "vitest";
import { withEdits, withoutZone, withPlanFields, withUpdatedZone, withZone } from "./edits";
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
    hitPadding: 0,
    label: { dx: 1, dy: 2 },
    version: 1,
    content: { en, ru },
    ...overrides,
  };
}

const plan: PlanResponse = {
  id: "p1",
  name: "Office",
  viewBox: [0, 0, 800, 600],
  pxPerMeter: 32,
  background: "demo-office",
  version: 4,
  zones: [zone("a"), zone("b")],
};

describe("withEdits", () => {
  it("returns the plan itself without edits", () => {
    expect(withEdits(plan, [])).toBe(plan);
  });

  it("applies the fields of a zone change and keeps the rest and the version", () => {
    const circle = { kind: "circle" as const, cx: 5, cy: 6, r: 7 };
    const edited = withEdits(plan, [{ kind: "updateZone", zoneId: "a", changes: { shape: circle, color: "#000000" } }]);
    expect(edited.zones[0]).toEqual({ ...zone("a"), shape: circle, color: "#000000" });
    expect(edited.zones[1]).toBe(plan.zones[1]);
  });

  it("treats null as a value and replaces only the languages sent", () => {
    const changed = { ...ru, name: "Приёмная" };
    const edited = withEdits(plan, [
      { kind: "updateZone", zoneId: "a", changes: { hitPadding: null, label: null, content: { ru: changed } } },
    ]);
    expect(edited.zones[0]).toMatchObject({ hitPadding: null, label: null, content: { en, ru: changed } });
  });

  it("applies edits in order, later ones over earlier ones", () => {
    const edited = withEdits(plan, [
      { kind: "updateZone", zoneId: "b", changes: { color: "#111111" } },
      { kind: "updatePlan", changes: { name: "Renamed", background: null } },
      { kind: "updateZone", zoneId: "b", changes: { color: "#222222", zIndex: 9 } },
    ]);
    expect(edited).toMatchObject({ name: "Renamed", background: null, version: 4 });
    expect(edited.zones[1]).toMatchObject({ color: "#222222", zIndex: 9 });
  });

  it("hides a deleted zone, and a change to it after that changes nothing", () => {
    const edited = withEdits(plan, [
      { kind: "deleteZone", zoneId: "a" },
      { kind: "updateZone", zoneId: "a", changes: { color: "#000000" } },
    ]);
    expect(edited.zones.map((item) => item.id)).toEqual(["b"]);
  });

  it("does not show a new zone before the server has given it an id", () => {
    const body = { type: "custom" as const, shape: plan.zones[0].shape, color: "#123456", content: { en, ru } };
    expect(withEdits(plan, [{ kind: "createZone", body }]).zones).toHaveLength(2);
  });
});

describe("what the server says", () => {
  const { zones: _zones, ...fields } = plan;

  describe("withZone: a created zone", () => {
    it("goes last", () => {
      expect(withZone(plan, zone("c")).zones.map((item) => item.id)).toEqual(["a", "b", "c"]);
    });

    it("is not added twice when both its event and its answer arrive", () => {
      const created = zone("c");
      expect(withZone(withZone(plan, created), created).zones.map((item) => item.id)).toEqual(["a", "b", "c"]);
    });

    it("does not undo a change that overtook it", () => {
      const changed = zone("c", { color: "#000000", version: 2 });
      expect(withZone(withZone(plan, changed), zone("c")).zones[2]).toEqual(changed);
    });
  });

  describe("withUpdatedZone: a changed zone", () => {
    it("replaces a known zone in place at a newer version", () => {
      const changed = zone("a", { color: "#000000", version: 2 });
      expect(withUpdatedZone(plan, changed).zones).toEqual([changed, plan.zones[1]]);
    });

    it("replaces it at the same version", () => {
      const same = zone("a", { color: "#000000" });
      expect(withUpdatedZone(plan, same).zones[0]).toEqual(same);
    });

    it("is ignored at an older version", () => {
      const newer = withUpdatedZone(plan, zone("a", { color: "#222222", version: 3 }));
      const older = zone("a", { color: "#111111", version: 2 });
      expect(withUpdatedZone(newer, older)).toEqual(newer);
    });

    it("does not bring a deleted zone back", () => {
      expect(withUpdatedZone(withoutZone(plan, "a"), zone("a", { version: 2 })).zones.map((item) => item.id)).toEqual(["b"]);
    });
  });

  describe("withoutZone: a deleted zone", () => {
    it("goes, and leaves the others", () => {
      expect(withoutZone(plan, "a").zones.map((item) => item.id)).toEqual(["b"]);
    });

    it("changes nothing when already gone", () => {
      expect(withoutZone(withoutZone(plan, "a"), "a").zones.map((item) => item.id)).toEqual(["b"]);
    });
  });

  describe("withPlanFields: the plan's fields", () => {
    it("are taken at a newer version, and the zones stay", () => {
      expect(withPlanFields(plan, { ...fields, name: "Renamed", version: 5 })).toEqual({ ...plan, name: "Renamed", version: 5 });
    });

    it("are taken at the same version", () => {
      expect(withPlanFields(plan, { ...fields, name: "Renamed" }).name).toBe("Renamed");
    });

    it("are ignored at an older version", () => {
      expect(withPlanFields(plan, { ...fields, name: "Old", version: 3 })).toBe(plan);
    });

    it("do not bring older zones with a PATCH answer", () => {
      const answer = { ...plan, name: "Renamed", version: 5, zones: [zone("a")] };
      expect(withPlanFields(plan, answer)).toEqual({ ...plan, name: "Renamed", version: 5 });
    });
  });
});
