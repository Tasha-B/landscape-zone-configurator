import type { PlanChanges, PlanResponse } from "../../lib/api/types";
import type { Translations } from "../../lib/i18n/translations";
import { DEMO_OFFICE } from "../SpaceMapper/PlanBackground";
import Field from "./Field";
import { FIELD_CLASS, LABEL_CLASS } from "./fieldStyles";

// The API's limit (CreatePlanDto)
const MAX_NAME = 200;
const POSITIVE = /^\d+(\.\d+)?$/;

interface PlanPanelProps {
  plan: PlanResponse;
  t: Translations;
  onChange: (changes: PlanChanges) => void;
}

// The plan itself, shown while no zone is selected. The sheet keeps its
// top-left corner when its size changes; zones are not moved, so a smaller
// sheet can leave some outside it.
export default function PlanPanel({ plan, t, onChange }: PlanPanelProps) {
  const e = t.editor;
  const [minX, minY, width, height] = plan.viewBox;
  const positive = (text: string) => (POSITIVE.test(text) && Number(text) > 0 ? null : e.numberInvalid);

  return (
    <section aria-labelledby="plan-panel-title" className="flex flex-col gap-sm">
      <h2 id="plan-panel-title" className="font-display text-card-title text-forest-dark">
        {e.planPanel}
      </h2>
      <p className="font-body text-xs text-ink/60">{e.panelHint}</p>

      <Field
        label={e.name}
        value={plan.name}
        maxLength={MAX_NAME}
        requiredMessage={e.required}
        onCommit={(name) => onChange({ name })}
      />
      <div className="grid grid-cols-2 gap-xs">
        <Field
          label={e.width}
          value={String(width)}
          inputMode="decimal"
          requiredMessage={e.required}
          validate={positive}
          onCommit={(text) => onChange({ viewBox: [minX, minY, Number(text), height] })}
        />
        <Field
          label={e.height}
          value={String(height)}
          inputMode="decimal"
          requiredMessage={e.required}
          validate={positive}
          onCommit={(text) => onChange({ viewBox: [minX, minY, width, Number(text)] })}
        />
      </div>
      <Field
        label={e.scale}
        value={String(plan.pxPerMeter)}
        inputMode="decimal"
        requiredMessage={e.required}
        validate={positive}
        onCommit={(text) => onChange({ pxPerMeter: Number(text) })}
      />
      <label className={LABEL_CLASS}>
        {e.background}
        <select
          value={plan.background ?? ""}
          onChange={(event) => onChange({ background: event.target.value === DEMO_OFFICE ? DEMO_OFFICE : null })}
          className={FIELD_CLASS}
        >
          <option value="">{e.backgroundNone}</option>
          <option value={DEMO_OFFICE}>{e.backgroundDemo}</option>
        </select>
      </label>
    </section>
  );
}
