import type { ZoneType } from "../plan/types";

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
    back: string;
    loading: string;
    loadError: string;
    retry: string;
    notFound: string;
    help: string;
    canvasLabel: string;
    toolbarLabel: string;
    addRect: string;
    addCircle: string;
    addPolygon: string;
    deleteZone: string;
    deleteConfirm: string;
    deleteYes: string;
    deleteNo: string;
    saving: string;
    saved: string;
    saveFailed: string;
    conflict: string;
    offline: string;
    zonePanel: string;
    planPanel: string;
    panelHint: string;
    type: string;
    color: string;
    colorInvalid: string;
    name: string;
    tagline: string;
    recommendation: string;
    rationale: string;
    required: string;
    width: string;
    height: string;
    scale: string;
    numberInvalid: string;
    background: string;
    backgroundNone: string;
    backgroundDemo: string;
    smallScreen: string;
  };
  // ZoneType names (lib/plan/types.ts)
  zoneTypes: Record<ZoneType, string>;
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
      back: "← Plans",
      loading: "Loading the plan…",
      loadError: "The plan could not be loaded",
      retry: "Try again",
      notFound: "This plan does not exist. It may have been deleted.",
      help: "Click a zone to select it, drag it to move it, drag its handles to resize it. Arrow keys move the selected zone (with Shift, by 10). Esc clears the selection.",
      canvasLabel: "Plan “{name}”",
      toolbarLabel: "Zone tools",
      addRect: "+ Rectangle",
      addCircle: "+ Circle",
      addPolygon: "+ Polygon",
      deleteZone: "Delete zone",
      deleteConfirm: "Delete “{name}”? This cannot be undone.",
      deleteYes: "Delete for good",
      deleteNo: "Cancel",
      saving: "Saving…",
      saved: "All changes saved",
      saveFailed: "Could not save. The change was undone.",
      conflict: "This plan was changed elsewhere and has been reloaded.",
      offline: "No connection to the server. Changes are not saved until it is back.",
      zonePanel: "Zone",
      planPanel: "Plan",
      panelHint: "Select a zone to edit it. With no zone selected, this panel edits the plan.",
      type: "Type",
      color: "Color",
      colorInvalid: "Use the form #rrggbb",
      name: "Name",
      tagline: "Tagline",
      recommendation: "Recommendation",
      rationale: "Rationale",
      required: "Fill this in",
      width: "Width",
      height: "Height",
      scale: "Units per meter",
      numberInvalid: "A number above 0",
      background: "Background",
      backgroundNone: "Blank sheet",
      backgroundDemo: "Demo office artwork",
      smallScreen: "The editor needs a wider screen. Open it on a tablet or a computer.",
    },
    zoneTypes: {
      reception: "Reception",
      "meeting-room": "Meeting room",
      "open-floor": "Open floor",
      "break-room": "Break room",
      "signature-corner": "Signature corner",
      custom: "Custom",
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
      back: "← Планы",
      loading: "Загружаем план…",
      loadError: "Не удалось загрузить план",
      retry: "Попробовать снова",
      notFound: "Такого плана нет. Возможно, его удалили.",
      help: "Нажмите на зону, чтобы выбрать её; перетащите, чтобы передвинуть; тяните за маркеры, чтобы изменить размер. Стрелки двигают выбранную зону (с Shift — на 10). Esc снимает выбор.",
      canvasLabel: "План «{name}»",
      toolbarLabel: "Инструменты зон",
      addRect: "+ Прямоугольник",
      addCircle: "+ Круг",
      addPolygon: "+ Многоугольник",
      deleteZone: "Удалить зону",
      deleteConfirm: "Удалить «{name}»? Это нельзя отменить.",
      deleteYes: "Удалить насовсем",
      deleteNo: "Отмена",
      saving: "Сохраняем…",
      saved: "Все изменения сохранены",
      saveFailed: "Не удалось сохранить. Изменение отменено.",
      conflict: "План изменили в другом месте, мы его перезагрузили.",
      offline: "Нет связи с сервером. Изменения не сохраняются, пока она не восстановится.",
      zonePanel: "Зона",
      planPanel: "План",
      panelHint: "Выберите зону, чтобы её редактировать. Без выбранной зоны здесь редактируется план.",
      type: "Тип",
      color: "Цвет",
      colorInvalid: "Нужен вид #rrggbb",
      name: "Название",
      tagline: "Подзаголовок",
      recommendation: "Рекомендация",
      rationale: "Обоснование",
      required: "Заполните поле",
      width: "Ширина",
      height: "Высота",
      scale: "Единиц на метр",
      numberInvalid: "Число больше 0",
      background: "Фон",
      backgroundNone: "Чистый лист",
      backgroundDemo: "Рисунок демо-офиса",
      smallScreen: "Редактору нужен экран пошире. Откройте его на планшете или компьютере.",
    },
    zoneTypes: {
      reception: "Ресепшен",
      "meeting-room": "Переговорная",
      "open-floor": "Открытое пространство",
      "break-room": "Зона отдыха",
      "signature-corner": "Фирменный уголок",
      custom: "Другое",
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
