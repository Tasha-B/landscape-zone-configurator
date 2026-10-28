import type { FloorPlan } from "../lib/plan/types";

// The Cairn Botanics office from phase 0 as one FloorPlan. It becomes the
// database seed in phase 3.
//
// Coordinates are in the 800 × 600 viewBox of the sketch. Zones are inset
// from the wall lines (6 from the outer wall, 8 from inner walls), so the
// marker never paints over a wall. At 32 px per meter reception is 28 m².
//
// Label offsets keep the names where the design placed them, clear of the
// furniture drawn in PlanBackground.
export const demoPlan: FloorPlan = {
  id: "demo",
  name: "Cairn Botanics office",
  viewBox: [0, 0, 800, 600],
  pxPerMeter: 32,
  // Legend order
  zones: [
    {
      id: "reception",
      type: "reception",
      shape: { kind: "rect", x: 88, y: 98, width: 214, height: 134, rx: 4 },
      color: "#C9962A",
      zIndex: 1,
      label: { dx: 31, dy: -19 },
      content: {
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
    },
    {
      id: "meeting-room",
      type: "meeting-room",
      shape: { kind: "rect", x: 318, y: 98, width: 234, height: 134, rx: 4 },
      color: "#7A9A5B",
      zIndex: 2,
      // The area caption sits inside the drawn table
      label: { dx: 0, dy: -25, areaDy: 34 },
      content: {
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
    },
    {
      id: "open-floor",
      type: "open-floor",
      // L-shaped: the corridor, the area right of the break room and the
      // curved bay. The bay follows the outer wall's Bézier curve, sampled
      // at 12 points and inset by 6.
      shape: {
        kind: "polygon",
        points: [
          [88, 248],
          [553, 248],
          [554, 307],
          [591, 310],
          [616, 319],
          [635, 332],
          [649, 348],
          [658, 365],
          [661, 384],
          [658, 403],
          [650, 421],
          [636, 437],
          [617, 450],
          [592, 458],
          [560, 462],
          [328, 462],
          [328, 342],
          [88, 342],
        ],
      },
      color: "#5FA88C",
      zIndex: 0, // drawn first: the signature corner sits on top of it
      // The centroid falls in the lower-right part; the name stays in the corridor
      label: { dx: -163, dy: -52 },
      content: {
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
    },
    {
      id: "break-room",
      type: "break-room",
      shape: { kind: "rect", x: 88, y: 358, width: 224, height: 104, rx: 4 },
      color: "#C4703C",
      zIndex: 3,
      label: { dx: 0, dy: -10 },
      content: {
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
    },
    {
      id: "signature-corner",
      type: "signature-corner",
      shape: { kind: "circle", cx: 588, cy: 385, r: 68 },
      color: "#9A7A8C",
      zIndex: 4,
      // It sits on top of the open floor; a padded hit area would steal
      // clicks from the floor around it
      hitPadding: 0,
      label: { dx: 0, dy: -9, fontSize: 20 },
      content: {
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
    },
  ],
};
