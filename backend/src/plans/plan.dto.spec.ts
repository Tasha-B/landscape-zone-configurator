import { describe, expect, it } from "vitest";
import { invalidPaths } from "../validation.js";
import { CreatePlanDto, UpdatePlanDto } from "./plan.dto.js";

const plan = { name: "Second floor", viewBox: [0, 0, 1000, 700], pxPerMeter: 25 };

describe("CreatePlanDto", () => {
  it("accepts a plan with or without a background", async () => {
    expect(await invalidPaths(CreatePlanDto, plan)).toEqual([]);
    expect(await invalidPaths(CreatePlanDto, { ...plan, background: "demo-office" })).toEqual([]);
    expect(await invalidPaths(CreatePlanDto, { ...plan, background: null })).toEqual([]);
  });

  it("requires a name, a viewBox and a scale", async () => {
    expect(await invalidPaths(CreatePlanDto, {})).toEqual(["name", "viewBox", "pxPerMeter"]);
    expect(await invalidPaths(CreatePlanDto, { ...plan, name: "" })).toEqual(["name"]);
    expect(await invalidPaths(CreatePlanDto, { ...plan, name: "x".repeat(201) })).toEqual(["name"]);
    expect(await invalidPaths(CreatePlanDto, { ...plan, pxPerMeter: 0 })).toEqual(["pxPerMeter"]);
  });

  it("requires four finite numbers and an area in the viewBox", async () => {
    for (const viewBox of [[0, 0, 800], [0, 0, 800, 600, 1], [0, 0, 0, 600], [0, 0, 800, -1], [0, "0", 800, 600]]) {
      expect(await invalidPaths(CreatePlanDto, { ...plan, viewBox })).toEqual(["viewBox"]);
    }
    expect(await invalidPaths(CreatePlanDto, { ...plan, viewBox: [-100, -50, 800, 600] })).toEqual([]);
  });

  it("accepts only the backgrounds the frontend can draw", async () => {
    expect(await invalidPaths(CreatePlanDto, { ...plan, background: "https://example.com/plan.png" })).toEqual([
      "background",
    ]);
  });

  it("rejects unknown fields", async () => {
    expect(await invalidPaths(CreatePlanDto, { ...plan, zones: [] })).toEqual(["zones"]);
    expect(await invalidPaths(CreatePlanDto, { ...plan, version: 1 })).toEqual(["version"]);
  });
});

describe("UpdatePlanDto", () => {
  it("accepts any subset of fields with a version", async () => {
    expect(await invalidPaths(UpdatePlanDto, { version: 1, name: "Renamed" })).toEqual([]);
    expect(await invalidPaths(UpdatePlanDto, { version: 3, viewBox: [0, 0, 400, 300], background: null })).toEqual([]);
  });

  it("accepts null only for the background", async () => {
    for (const field of ["name", "viewBox", "pxPerMeter"]) {
      expect(await invalidPaths(UpdatePlanDto, { version: 1, [field]: null })).toEqual([field]);
    }
  });

  it("validates changed fields like on create", async () => {
    expect(await invalidPaths(UpdatePlanDto, { version: 1, viewBox: [0, 0, 0, 0] })).toEqual(["viewBox"]);
    expect(await invalidPaths(UpdatePlanDto, { version: 1, background: "office" })).toEqual(["background"]);
  });

  it("requires a positive integer version", async () => {
    expect(await invalidPaths(UpdatePlanDto, { name: "Renamed" })).toEqual(["version"]);
    expect(await invalidPaths(UpdatePlanDto, { version: "1", name: "Renamed" })).toEqual(["version"]);
  });
});
