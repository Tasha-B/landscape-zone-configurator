import type { Lang } from "../../lib/i18n/translations";

export interface SpaceZoneContent {
  name: string;
  tagline: string;
  recommendation: string;
  rationale: string;
}

export interface SpaceZone {
  id: string;
  en: SpaceZoneContent;
  ru: SpaceZoneContent;
}

// Bilingual copy sourced 1:1 from the approved design's ZONES data
// (Cairn Botanics Redesign.dc.html). The design uses one short, unified
// name per zone in both languages — used for the on-map label, the aria
// label, and the recommendation-panel title alike. That's a small tightening
// from this repo's old English-only long-form names ("Executive / Signature
// Corner", "Open Floor / Circulation") — keeping the old long form in one
// language and the design's short form in the other would leave EN/RU
// asymmetric, so both languages adopt the design's short form.
export const spaceZones: SpaceZone[] = [
  {
    id: "reception",
    en: {
      name: "Reception",
      tagline: "First impression",
      recommendation: "A single statement orchid or sculptural arrangement",
      rationale:
        "This is where a client forms their first impression of you. One deliberate specimen carries that moment",
    },
    ru: {
      name: "Ресепшен",
      tagline: "Первое впечатление",
      recommendation: "Одна статусная орхидея или скульптурная композиция",
      rationale:
        "Здесь клиент составляет первое впечатление о вас. Один продуманный экземпляр несёт этот момент",
    },
  },
  {
    id: "meeting-room",
    en: {
      name: "Meeting room",
      tagline: "Where focus lives",
      recommendation: "Ikebana-style minimal composition",
      rationale: "Negative space matters as much as the plant. Restraint keeps the room focused",
    },
    ru: {
      name: "Переговорная",
      tagline: "Территория фокуса",
      recommendation: "Минималистичная композиция в духе икебаны",
      rationale: "Пустота значит не меньше растения. Сдержанность держит фокус",
    },
  },
  {
    id: "signature-corner",
    en: {
      name: "Signature corner",
      tagline: "The one object",
      recommendation: "A curated terrarium or bonsai",
      rationale: "One object, contained and deliberate — considered, purposeful, permanent",
    },
    ru: {
      name: "Знаковый угол",
      tagline: "Один объект",
      recommendation: "Кураторский террариум или бонсай",
      rationale: "Один объект, замкнутый и намеренный — обдуманно, осмысленно, надолго",
    },
  },
  {
    id: "break-room",
    en: {
      name: "Break room",
      tagline: "Where people actually relax",
      recommendation: "Tactile, low-maintenance living greenery",
      rationale: "This space earns its plants through use. Texture invites touch",
    },
    ru: {
      name: "Комната отдыха",
      tagline: "Где действительно отдыхают",
      recommendation: "Тактильная неприхотливая зелень",
      rationale: "Это пространство заслуживает растения использованием. Фактура приглашает прикоснуться",
    },
  },
  {
    id: "open-floor",
    en: {
      name: "Open floor",
      tagline: "Greenery as architecture",
      recommendation: "Privacy-defining planters",
      rationale:
        "Greenery as architecture — softening sightlines, shaping how people move through the space",
    },
    ru: {
      name: "Опенспейс",
      tagline: "Зелень как архитектура",
      recommendation: "Кадки, задающие приватность",
      rationale: "Зелень как архитектура: смягчает сайтлайны и направляет движение людей",
    },
  },
];

export function zoneContent(zone: SpaceZone, lang: Lang): SpaceZoneContent {
  return zone[lang];
}
