import type { Lang } from "./translations";

// "{count} zones" and the like: the form Intl.PluralRules picks for the
// language ("1 зона", "2 зоны", "5 зон")
export interface PluralForms {
  one: string;
  few: string;
  many: string;
  other: string;
}

export function plural(lang: Lang, count: number, forms: PluralForms): string {
  const rule = new Intl.PluralRules(lang).select(count);
  const form = rule === "one" || rule === "few" || rule === "many" ? forms[rule] : forms.other;
  return fill(form, { count: String(count) });
}

// Replaces {name} placeholders
export function fill(text: string, values: Record<string, string>): string {
  return text.replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match);
}

export function formatDateTime(lang: Lang, iso: string): string {
  return new Intl.DateTimeFormat(lang, { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
}
