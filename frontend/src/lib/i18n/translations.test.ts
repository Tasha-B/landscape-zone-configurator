import { describe, expect, it } from "vitest";
import { translations, type Lang } from "./translations";

// Affixes around a number may be empty in one language ("" + "3 zones selected")
const MAY_BE_EMPTY = new Set(["zonesSelectedPrefix", "zonesSelectedSuffix"]);

describe("translations", () => {
  const langs = Object.keys(translations) as Lang[];

  it.each(langs)("%s has no blank strings", (lang) => {
    const blank = Object.entries(translations[lang].map)
      .filter(([key, value]) => !MAY_BE_EMPTY.has(key) && value.trim() === "")
      .map(([key]) => key);

    expect(blank).toEqual([]);
  });
});
