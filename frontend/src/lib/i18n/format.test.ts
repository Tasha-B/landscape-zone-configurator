import { describe, expect, it } from "vitest";
import { fill, formatDateTime, plural } from "./format";
import { translations } from "./translations";

const forms = (lang: "en" | "ru") => {
  const t = translations[lang].plans;
  return { one: t.zonesOne, few: t.zonesFew, many: t.zonesMany, other: t.zonesOther };
};

describe("plural", () => {
  it("picks the Russian form by the number", () => {
    expect([0, 1, 2, 5, 11, 21, 22, 25].map((n) => plural("ru", n, forms("ru")))).toEqual([
      "0 зон",
      "1 зона",
      "2 зоны",
      "5 зон",
      "11 зон",
      "21 зона",
      "22 зоны",
      "25 зон",
    ]);
  });

  it("uses one and other in English", () => {
    expect([0, 1, 2].map((n) => plural("en", n, forms("en")))).toEqual(["0 zones", "1 zone", "2 zones"]);
  });
});

describe("fill", () => {
  it("replaces the placeholders it has values for", () => {
    expect(fill("Delete “{name}”? {unknown}", { name: "Office" })).toBe("Delete “Office”? {unknown}");
  });
});

describe("formatDateTime", () => {
  it("formats a date in the language", () => {
    const iso = "2026-11-01T09:30:00Z";
    expect(formatDateTime("en", iso)).toMatch(/Nov 1, 2026/);
    expect(formatDateTime("ru", iso)).toMatch(/1 нояб\.? 2026/);
  });
});
