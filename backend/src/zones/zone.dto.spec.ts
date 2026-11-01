import { plainToInstance } from "class-transformer";
import { describe, expect, it } from "vitest";
import { invalidPaths } from "../validation.js";
import { CircleShape, PolygonShape, RectShape } from "./shape.js";
import { CreateZoneDto, UpdateZoneDto } from "./zone.dto.js";

const content = { name: "Reception", tagline: "First impression", recommendation: "r", rationale: "why" };

const rect = { kind: "rect", x: 88, y: 98, width: 214, height: 134, rx: 4 };
const circle = { kind: "circle", cx: 10, cy: 20, r: 5 };
const polygon = {
  kind: "polygon",
  points: [
    [0, 0],
    [10, 0],
    [0, 10],
  ],
};

function zone(overrides: Record<string, unknown> = {}) {
  return { type: "reception", shape: rect, color: "#C9962A", content: { en: content, ru: content }, ...overrides };
}

describe("CreateZoneDto", () => {
  it("accepts each shape kind and turns it into its class", async () => {
    for (const [shape, cls] of [
      [rect, RectShape],
      [circle, CircleShape],
      [polygon, PolygonShape],
    ] as const) {
      expect(await invalidPaths(CreateZoneDto, zone({ shape }))).toEqual([]);
      expect(plainToInstance(CreateZoneDto, zone({ shape })).shape).toBeInstanceOf(cls);
    }
  });

  it("accepts the optional fields, and null for hitPadding and label", async () => {
    const full = { zIndex: 3, hitPadding: 0, label: { dx: 1, dy: -2, fontSize: 14, areaDy: 20 } };
    expect(await invalidPaths(CreateZoneDto, zone(full))).toEqual([]);
    expect(await invalidPaths(CreateZoneDto, zone({ hitPadding: null, label: null }))).toEqual([]);
  });

  it("rejects an unknown or missing shape kind", async () => {
    // The error names kind, and the other fields are unknown to it
    for (const shape of [{ kind: "star", r: 5 }, { r: 5 }]) {
      expect((await invalidPaths(CreateZoneDto, zone({ shape }))).sort()).toEqual(["shape.kind", "shape.r"]);
    }
    expect(await invalidPaths(CreateZoneDto, zone({ shape: "rect" }))).toEqual(["shape"]);
    expect(await invalidPaths(CreateZoneDto, zone({ shape: undefined }))).toEqual(["shape"]);
  });

  it("rejects shapes without an area or with bad points", async () => {
    expect(await invalidPaths(CreateZoneDto, zone({ shape: { ...rect, width: 0 } }))).toEqual(["shape.width"]);
    expect(await invalidPaths(CreateZoneDto, zone({ shape: { ...rect, rx: -1 } }))).toEqual(["shape.rx"]);
    expect(await invalidPaths(CreateZoneDto, zone({ shape: { ...circle, r: -5 } }))).toEqual(["shape.r"]);
    expect(await invalidPaths(CreateZoneDto, zone({ shape: { ...polygon, points: polygon.points.slice(0, 2) } }))).toEqual(
      ["shape.points"],
    );
    const badPoints = [[0, 0], [10, 0, 1], ["0", 10]];
    expect(await invalidPaths(CreateZoneDto, zone({ shape: { ...polygon, points: badPoints } }))).toEqual([
      "shape.points",
    ]);
  });

  it("rejects numbers JSON cannot carry and numbers sent as strings", async () => {
    expect(await invalidPaths(CreateZoneDto, zone({ shape: { ...circle, cx: Infinity } }))).toEqual(["shape.cx"]);
    expect(await invalidPaths(CreateZoneDto, zone({ shape: { ...circle, r: "5" } }))).toEqual(["shape.r"]);
  });

  it("rejects the fields of another shape kind and unknown fields", async () => {
    expect(await invalidPaths(CreateZoneDto, zone({ shape: { ...rect, r: 5 } }))).toEqual(["shape.r"]);
    expect(await invalidPaths(CreateZoneDto, zone({ position: 0 }))).toEqual(["position"]);
    expect(await invalidPaths(CreateZoneDto, zone({ content: { en: content, ru: content, de: content } }))).toEqual([
      "content.de",
    ]);
  });

  it("checks type, color, hitPadding and label", async () => {
    expect(await invalidPaths(CreateZoneDto, zone({ type: "MEETING_ROOM" }))).toEqual(["type"]);
    expect(await invalidPaths(CreateZoneDto, zone({ color: "#C9962" }))).toEqual(["color"]);
    expect(await invalidPaths(CreateZoneDto, zone({ color: "red" }))).toEqual(["color"]);
    expect(await invalidPaths(CreateZoneDto, zone({ hitPadding: -1 }))).toEqual(["hitPadding"]);
    expect(await invalidPaths(CreateZoneDto, zone({ zIndex: 1.5 }))).toEqual(["zIndex"]);
    expect(await invalidPaths(CreateZoneDto, zone({ zIndex: null }))).toEqual(["zIndex"]);
    expect(await invalidPaths(CreateZoneDto, zone({ label: { dx: 1 } }))).toEqual(["label.dy"]);
    expect(await invalidPaths(CreateZoneDto, zone({ label: { dx: 1, dy: 2, fontSize: 0 } }))).toEqual([
      "label.fontSize",
    ]);
  });

  it("requires both languages with every text filled in", async () => {
    expect(await invalidPaths(CreateZoneDto, zone({ content: { en: content } }))).toEqual(["content.ru"]);
    expect(await invalidPaths(CreateZoneDto, zone({ content: undefined }))).toEqual(["content"]);
    expect(await invalidPaths(CreateZoneDto, zone({ content: { en: content, ru: { ...content, name: "" } } }))).toEqual(
      ["content.ru.name"],
    );
    const long = { ...content, tagline: "x".repeat(201) };
    expect(await invalidPaths(CreateZoneDto, zone({ content: { en: long, ru: content } }))).toEqual([
      "content.en.tagline",
    ]);
  });
});

describe("UpdateZoneDto", () => {
  it("accepts any subset of fields with a version", async () => {
    expect(await invalidPaths(UpdateZoneDto, { version: 1, color: "#123456" })).toEqual([]);
    expect(await invalidPaths(UpdateZoneDto, { version: 2, shape: circle, content: { ru: content } })).toEqual([]);
  });

  it("accepts null only for hitPadding and label", async () => {
    expect(await invalidPaths(UpdateZoneDto, { version: 1, hitPadding: null, label: null })).toEqual([]);
    for (const field of ["type", "shape", "color", "zIndex", "content"]) {
      expect(await invalidPaths(UpdateZoneDto, { version: 1, [field]: null })).toEqual([field]);
    }
    expect(await invalidPaths(UpdateZoneDto, { version: 1, content: { en: null } })).toEqual(["content.en"]);
  });

  it("requires a positive integer version", async () => {
    expect(await invalidPaths(UpdateZoneDto, { color: "#123456" })).toEqual(["version"]);
    expect(await invalidPaths(UpdateZoneDto, { version: 0, color: "#123456" })).toEqual(["version"]);
  });

  it("validates a changed shape and content like on create", async () => {
    expect(await invalidPaths(UpdateZoneDto, { version: 1, shape: { ...rect, height: -1 } })).toEqual([
      "shape.height",
    ]);
    expect(await invalidPaths(UpdateZoneDto, { version: 1, content: { en: { ...content, rationale: "" } } })).toEqual(
      ["content.en.rationale"],
    );
  });
});
