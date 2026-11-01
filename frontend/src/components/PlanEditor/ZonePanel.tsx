import type { ZoneChanges, ZoneResponse } from "../../lib/api/types";
import { useRovingTabIndex } from "../../lib/a11y/roving";
import { ZONE_PALETTE } from "../../lib/editor/newZone";
import type { Lang, Translations } from "../../lib/i18n/translations";
import type { ZoneContent, ZoneType } from "../../lib/plan/types";
import Field from "./Field";
import { FIELD_CLASS, LABEL_CLASS } from "./fieldStyles";

const COLOR = /^#[0-9a-fA-F]{6}$/;
// The API's limits (ZoneContent)
const MAX_SHORT_TEXT = 200;
const ZONE_TYPES: ZoneType[] = ["reception", "meeting-room", "open-floor", "break-room", "signature-corner", "custom"];
const ALL_ENABLED = ZONE_PALETTE.map(() => true);

interface ZonePanelProps {
  zone: ZoneResponse;
  lang: Lang;
  t: Translations;
  onChange: (changes: ZoneChanges) => void;
}

// The selected zone's type, color and texts. The texts are those of the
// page's language, the one the canvas and the showcase show; the other
// language keeps its texts (a new zone's drafts) until the page can switch
// language. A changed text sends its language whole.
export default function ZonePanel({ zone, lang, t, onChange }: ZonePanelProps) {
  const e = t.editor;
  const setText = (field: keyof ZoneContent, text: string) =>
    onChange({ content: { [lang]: { ...zone.content[lang], [field]: text } } });
  // The palette is one stop for Tab; the arrow keys move between its colors
  const swatch = useRovingTabIndex(ALL_ENABLED);

  return (
    <section aria-labelledby="zone-panel-title" className="flex flex-col gap-sm">
      <h2 id="zone-panel-title" className="font-display text-card-title text-forest-dark">
        {e.zonePanel}: {zone.content[lang].name}
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
          {ZONE_PALETTE.map((color, index) => {
            const current = zone.color.toUpperCase() === color;
            return (
              <button
                key={color}
                type="button"
                aria-label={color}
                aria-pressed={current}
                {...swatch(index)}
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

      <div className="flex flex-col gap-xs border-t border-forest-dark/10 pt-sm">
        {(["name", "tagline", "recommendation", "rationale"] as const).map((field) => (
          <Field
            key={`${zone.id}-${lang}-${field}`}
            label={e[field]}
            value={zone.content[lang][field]}
            requiredMessage={e.required}
            multiline={field === "recommendation" || field === "rationale"}
            maxLength={field === "name" || field === "tagline" ? MAX_SHORT_TEXT : undefined}
            onCommit={(text) => setText(field, text)}
          />
        ))}
      </div>
    </section>
  );
}
