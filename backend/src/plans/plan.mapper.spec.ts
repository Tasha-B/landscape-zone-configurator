import { describe, expect, it } from "vitest";
import { Lang, ZoneType } from "../generated/prisma/enums.js";
import { toPlanResponse, type PlanRow } from "./plan.mapper.js";

const createdAt = new Date("2026-10-31T00:00:00Z");
const updatedAt = createdAt;

function content(zoneId: string, lang: Lang) {
  return { zoneId, lang, name: `${lang} name`, tagline: "t", recommendation: "r", rationale: "why" };
}

function zone(id: string, overrides: Partial<PlanRow["zones"][number]> = {}): PlanRow["zones"][number] {
  return {
    id,
    planId: "plan",
    type: ZoneType.MEETING_ROOM,
    shape: { kind: "circle", cx: 10, cy: 20, r: 5 },
    color: "#123456",
    zIndex: 1,
    position: 0,
    hitPadding: null,
    label: null,
    version: 3,
    createdAt,
    updatedAt,
    content: [content(id, Lang.ru), content(id, Lang.en)],
    ...overrides,
  };
}

function plan(zones: PlanRow["zones"]): PlanRow {
  return {
    id: "plan",
    name: "Office",
    viewBox: [0, 0, 400, 300],
    pxPerMeter: 20,
    background: null,
    createdAt,
    updatedAt,
    zones,
  };
}

describe("toPlanResponse", () => {
  it("maps a plan to the frontend's names and structure", () => {
    const response = toPlanResponse(
      plan([zone("a", { hitPadding: 0, label: { dx: 1, dy: -2 }, type: ZoneType.SIGNATURE_CORNER })]),
    );

    expect(response).toEqual({
      id: "plan",
      name: "Office",
      viewBox: [0, 0, 400, 300],
      pxPerMeter: 20,
      background: null,
      zones: [
        {
          id: "a",
          type: "signature-corner",
          shape: { kind: "circle", cx: 10, cy: 20, r: 5 },
          color: "#123456",
          zIndex: 1,
          hitPadding: 0,
          label: { dx: 1, dy: -2 },
          version: 3,
          content: {
            en: { name: "en name", tagline: "t", recommendation: "r", rationale: "why" },
            ru: { name: "ru name", tagline: "t", recommendation: "r", rationale: "why" },
          },
        },
      ],
    });
  });

  it("keeps unset fields as null, so every field is present", () => {
    const [mapped] = toPlanResponse(plan([zone("a")])).zones;
    expect(mapped).toMatchObject({ hitPadding: null, label: null });
  });

  it("keeps the zones in the order they were read (legend order)", () => {
    const response = toPlanResponse(plan([zone("b", { zIndex: 0 }), zone("a", { zIndex: 5 })]));
    expect(response.zones.map((z) => z.id)).toEqual(["b", "a"]);
  });

  it("names every zone type the way the frontend does", () => {
    const types = Object.values(ZoneType).map((type) => toPlanResponse(plan([zone("a", { type })])).zones[0]!.type);
    expect(types).toEqual(["reception", "meeting-room", "open-floor", "break-room", "signature-corner", "custom"]);
  });

  it("refuses a zone without content in every language", () => {
    expect(() => toPlanResponse(plan([zone("a", { content: [content("a", Lang.en)] })]))).toThrow(
      'Zone a has no "ru" content',
    );
  });
});
