export type Lang = "en" | "ru";

// The map section of the original Cairn Botanics translations (the rest of
// the marketing site is not part of this project), and the texts of the
// plans page and the editor. Every text exists in both languages, although
// the page has no language switch yet.
export interface Translations {
  nav: {
    label: string;
    showcase: string;
    plans: string;
  };
  plans: {
    title: string;
    intro: string;
    newPlanLabel: string;
    create: string;
    creating: string;
    createError: string;
    loading: string;
    loadError: string;
    retry: string;
    empty: string;
    listLabel: string;
    // Plural forms with {count}: Intl.PluralRules picks one; English uses
    // only "one" and "other"
    zonesOne: string;
    zonesFew: string;
    zonesMany: string;
    zonesOther: string;
    changed: string;
    onShowcase: string;
    edit: string;
    delete: string;
    deleteConfirm: string;
    deleteYes: string;
    deleteNo: string;
    deleteError: string;
  };
  editor: {
    title: string;
  };
  notFound: {
    title: string;
    back: string;
  };
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
    nav: {
      label: "Main",
      showcase: "Showcase",
      plans: "Plans",
    },
    plans: {
      title: "Plans",
      intro: "Create a plan, then draw its zones in the editor.",
      newPlanLabel: "Name of the new plan",
      create: "Create plan",
      creating: "Creating…",
      createError: "The plan could not be created",
      loading: "Loading the plans…",
      loadError: "The plans could not be loaded",
      retry: "Try again",
      empty: "No plans yet. Create the first one above.",
      listLabel: "All plans",
      zonesOne: "{count} zone",
      zonesFew: "{count} zones",
      zonesMany: "{count} zones",
      zonesOther: "{count} zones",
      changed: "changed {date}",
      onShowcase: "on the showcase",
      edit: "Edit",
      delete: "Delete",
      deleteConfirm: "Delete “{name}” with all its zones? This cannot be undone.",
      deleteYes: "Delete for good",
      deleteNo: "Cancel",
      deleteError: "The plan could not be deleted",
    },
    editor: {
      title: "Edit plan",
    },
    notFound: {
      title: "This page does not exist",
      back: "Back to the showcase",
    },
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
    nav: {
      label: "Основная навигация",
      showcase: "Витрина",
      plans: "Планы",
    },
    plans: {
      title: "Планы",
      intro: "Создайте план, а затем нарисуйте его зоны в редакторе.",
      newPlanLabel: "Название нового плана",
      create: "Создать план",
      creating: "Создаём…",
      createError: "Не удалось создать план",
      loading: "Загружаем планы…",
      loadError: "Не удалось загрузить планы",
      retry: "Попробовать снова",
      empty: "Планов пока нет. Создайте первый выше.",
      listLabel: "Все планы",
      zonesOne: "{count} зона",
      zonesFew: "{count} зоны",
      zonesMany: "{count} зон",
      zonesOther: "{count} зоны",
      changed: "изменён {date}",
      onShowcase: "на витрине",
      edit: "Редактировать",
      delete: "Удалить",
      deleteConfirm: "Удалить «{name}» вместе со всеми зонами? Это нельзя отменить.",
      deleteYes: "Удалить насовсем",
      deleteNo: "Отмена",
      deleteError: "Не удалось удалить план",
    },
    editor: {
      title: "Редактирование плана",
    },
    notFound: {
      title: "Такой страницы нет",
      back: "Вернуться на витрину",
    },
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
