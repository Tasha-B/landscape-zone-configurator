import type { ZoneChanges, ZoneResponse } from "../../lib/api/types";
import { ZONE_PALETTE } from "../../lib/editor/newZone";
import type { Lang, Translations } from "../../lib/i18n/translations";
import type { ZoneContent, ZoneType } from "../../lib/plan/types";
import Field from "./Field";
import { FIELD_CLASS, LABEL_CLASS } from "./fieldStyles";

const COLOR = /^#[0-9a-fA-F]{6}$/;
// The API's limits (ZoneContent)
const MAX_SHORT_TEXT = 200;
const ZONE_TYPES: ZoneType[] = ["reception", "meeting-room", "open-floor", "break-room", "signature-corner", "custom"];
const LANGS: Lang[] = ["en", "ru"];

interface ZonePanelProps {
  zone: ZoneResponse;
  lang: Lang;
  t: Translations;
  onChange: (changes: ZoneChanges) => void;
}

// The selected zone's type, color and texts. Each language is edited here
// whatever language the page is in; a changed text sends its language whole.
export default function ZonePanel({ zone, lang: pageLang, t, onChange }: ZonePanelProps) {
  const e = t.editor;
  const setText = (lang: Lang, field: keyof ZoneContent, text: string) =>
    onChange({ content: { [lang]: { ...zone.content[lang], [field]: text } } });

  return (
    <section aria-labelledby="zone-panel-title" className="flex flex-col gap-sm">
      <h2 id="zone-panel-title" className="font-display text-card-title text-forest-dark">
        {e.zonePanel}: {zone.content[pageLang].name}
      </h2>

      <label className={LABEL_CLASS}>
        {e.type}
        <select
          value={zone.type}
          onChange={(event) => onChange({ type: event.target.value as ZoneType })}
          className={FIELD_CLASS}
        >
          {ZONE_TYPES.map((type) => (
            <option key={type} value={type}>
              {t.zoneTypes[type]}
            </option>
          ))}
        </select>
      </label>

      <fieldset className="flex flex-col gap-xs">
        <legend className="mb-1 font-body text-xs font-semibold text-forest-dark">{e.color}</legend>
        <div className="flex flex-wrap gap-1.5">
          {ZONE_PALETTE.map((color) => {
            const current = zone.color.toUpperCase() === color;
            return (
              <button
                key={color}
                type="button"
                aria-label={color}
                aria-pressed={current}
                onClick={() => !current && onChange({ color })}
                className="h-7 w-7 rounded-full border-2 border-paper outline-none ring-offset-1 focus-visible:ring-2 focus-visible:ring-gold aria-pressed:ring-2 aria-pressed:ring-forest-dark"
                style={{ background: color }}
              />
            );
          })}
        </div>
        <Field
          key={`${zone.id}-color`}
          label="#rrggbb"
          value={zone.color}
          requiredMessage={e.required}
          validate={(text) => (COLOR.test(text) ? null : e.colorInvalid)}
          onCommit={(color) => onChange({ color: color.toUpperCase() })}
        />
      </fieldset>

      {LANGS.map((lang) => (
        <fieldset key={lang} lang={lang} className="flex flex-col gap-xs border-t border-forest-dark/10 pt-sm">
          <legend className="font-body text-xs font-semibold uppercase tracking-wide text-ink/60">
            {lang === "en" ? e.english : e.russian}
          </legend>
          {(["name", "tagline", "recommendation", "rationale"] as const).map((field) => (
            <Field
              key={`${zone.id}-${lang}-${field}`}
              label={e[field]}
              value={zone.content[lang][field]}
              requiredMessage={e.required}
              multiline={field === "recommendation" || field === "rationale"}
              maxLength={field === "name" || field === "tagline" ? MAX_SHORT_TEXT : undefined}
              onCommit={(text) => setText(lang, field, text)}
            />
          ))}
        </fieldset>
      ))}
    </section>
  );
}
