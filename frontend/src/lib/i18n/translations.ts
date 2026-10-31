export type Lang = "en" | "ru";

// Only the map section of the original Cairn Botanics translations —
// the rest of the marketing site is not part of this project.
export interface Translations {
  map: {
    title: string;
    intro: string;
    sheetTitle: string;
    note: string;
    entry: string;
    paletteLabel: string;
    panelTitle: string;
    panelEmpty1: string;
    panelEmpty2: string;
    startOver: string;
    tapHint: string;
    exploreButton: string;
    zonesSelectedPrefix: string;
    zonesSelectedSuffix: string;
    mobileSheetLabel: string;
    mobileSheetClose: string;
    mobileSheetDone: string;
    loading: string;
    loadError: string;
    retry: string;
  };
}

export const translations: Record<Lang, Translations> = {
  en: {
    map: {
      title: "Map your space",
      intro:
        "Every office has zones with different roles. Tap the ones that matter to you — we'll sketch the approach we'd bring to each",
      sheetTitle: "Cairn Botanics — office planting concept",
      note: "sketch plan · not to scale · rev A",
      entry: "entry",
      paletteLabel: "palette",
      panelTitle: "Your plan",
      panelEmpty1: "Tap a zone on the sketch to begin",
      panelEmpty2: "Selected zones fill in with marker",
      startOver: "start over",
      tapHint: "tap a zone →",
      exploreButton: "Explore the plan",
      zonesSelectedPrefix: "",
      zonesSelectedSuffix: " zones selected",
      mobileSheetLabel: "Explore your space plan",
      mobileSheetClose: "Close",
      mobileSheetDone: "Done",
      loading: "loading the plan…",
      loadError: "The plan could not be loaded",
      retry: "Try again",
    },
  },
  ru: {
    map: {
      title: "Карта вашего пространства",
      intro:
        "В каждом офисе зоны живут по-разному. Отметьте те, что важны вам, — мы наметим подход к каждой",
      sheetTitle: "Cairn Botanics — office planting concept",
      note: "эскизный план · вне масштаба · ревизия А",
      entry: "вход",
      paletteLabel: "палитра",
      panelTitle: "Ваш план",
      panelEmpty1: "Нажмите на зону, чтобы начать",
      panelEmpty2: "Выбранные зоны заливаются маркером",
      startOver: "начать заново",
      tapHint: "нажми на зону →",
      exploreButton: "Изучить план",
      zonesSelectedPrefix: "Выбрано зон: ",
      zonesSelectedSuffix: "",
      mobileSheetLabel: "Изучить план пространства",
      mobileSheetClose: "Закрыть",
      mobileSheetDone: "Готово",
      loading: "загружаем план…",
      loadError: "Не удалось загрузить план",
      retry: "Попробовать снова",
    },
  },
};
