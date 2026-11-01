import { describe, expect, it } from "vitest";
import { nextIndex } from "./roving";

describe("nextIndex", () => {
  const all = [true, true, true, true];

  it("moves with the arrows and wraps around", () => {
    expect(nextIndex(0, "ArrowRight", all)).toBe(1);
    expect(nextIndex(3, "ArrowRight", all)).toBe(0);
    expect(nextIndex(0, "ArrowLeft", all)).toBe(3);
    expect(nextIndex(2, "ArrowDown", all)).toBe(3);
    expect(nextIndex(2, "ArrowUp", all)).toBe(1);
  });

  it("jumps to the first and last with Home and End", () => {
    expect(nextIndex(2, "Home", all)).toBe(0);
    expect(nextIndex(0, "End", all)).toBe(3);
  });

  it("skips disabled items", () => {
    const lastOff = [true, true, true, false];
    expect(nextIndex(2, "ArrowRight", lastOff)).toBe(0);
    expect(nextIndex(0, "ArrowLeft", lastOff)).toBe(2);
    expect(nextIndex(1, "End", lastOff)).toBe(2);
  });

  it("ignores other keys, and has nowhere to go when nothing else is enabled", () => {
    expect(nextIndex(0, "Enter", all)).toBeNull();
    expect(nextIndex(0, "ArrowRight", [true, false])).toBeNull();
  });
});
