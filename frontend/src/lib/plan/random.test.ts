import { describe, expect, it } from "vitest";
import { createRandom, hashString } from "./random";

const take = (next: () => number, count: number) => Array.from({ length: count }, next);

describe("hashString", () => {
  it("is stable and spreads similar strings apart", () => {
    expect(hashString("reception")).toBe(hashString("reception"));
    expect(hashString("zone-1")).not.toBe(hashString("zone-2"));
  });
});

describe("createRandom", () => {
  it("gives the same sequence for the same seed", () => {
    expect(take(createRandom("open-floor"), 20)).toEqual(take(createRandom("open-floor"), 20));
  });

  it("gives different sequences for different seeds", () => {
    expect(take(createRandom("open-floor"), 5)).not.toEqual(take(createRandom("break-room"), 5));
  });

  it("stays in [0, 1)", () => {
    for (const value of take(createRandom("range"), 1000)) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});
