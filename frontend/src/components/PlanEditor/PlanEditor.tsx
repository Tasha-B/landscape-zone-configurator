import { useState } from "react";
import { Link } from "react-router";
import { ApiError } from "../../lib/api/client";
import { useEditedPlan, usePlanEdits } from "../../lib/api/mutations";
import { fill } from "../../lib/i18n/format";
import { useLanguage } from "../../lib/i18n/LanguageProvider";
import Button from "../Button/Button";
import { PAPER_SHEET_CLASS } from "../SpaceMapper/SpaceMapperPlan";
import EditorCanvas from "./EditorCanvas";

const BACK_LINK = "font-body text-sm font-semibold text-forest-dark underline-offset-4 hover:underline";

// The editor of one plan. The plan shown is the server's with the changes
// still being saved on top; each change is saved as soon as it is made.
export default function PlanEditor({ planId }: { planId: string }) {
  const { lang, t } = useLanguage();
  const { data: plan, isPending, isError, error, isFetching, refetch } = useEditedPlan(planId);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saveErrors, setSaveErrors] = useState(0);
  const edits = usePlanEdits(planId, { onSaveError: () => setSaveErrors((count) => count + 1) });

  if (isPending) {
    return (
      <p role="status" className="mt-md font-body text-body text-ink/60">
        {t.editor.loading}
      </p>
    );
  }
  if (isError) {
    const missing = error instanceof ApiError && (error.status === 404 || error.status === 400);
    return (
      <div role="alert" className="mt-md flex flex-col items-start gap-sm">
        <p className="font-body text-body text-ink">{missing ? t.editor.notFound : t.editor.loadError}</p>
        {missing ? (
          <Link to="/plans" className={BACK_LINK}>
            {t.editor.back}
          </Link>
        ) : (
          <Button type="button" variant="secondary" disabled={isFetching} onClick={() => void refetch()}>
            {t.editor.retry}
          </Button>
        )}
      </div>
    );
  }

  if (!plan) return null;

  return (
    <div className="mt-md">
      <Link to="/plans" className={BACK_LINK}>
        {t.editor.back}
      </Link>
      <h2 className="mt-xs font-display text-card-title text-forest-dark">{plan.name}</h2>
      <p className="mt-xs max-w-[48rem] font-body text-sm text-ink/60">{t.editor.help}</p>
      <div className={`${PAPER_SHEET_CLASS} mt-md p-sm`}>
        <EditorCanvas
          plan={plan}
          lang={lang}
          label={fill(t.editor.canvasLabel, { name: plan.name })}
          selectedId={plan.zones.some((zone) => zone.id === selectedId) ? selectedId : null}
          onSelect={setSelectedId}
          onShapeChange={(zoneId, shape) => edits.updateZone(zoneId, { shape })}
          saveErrors={saveErrors}
        />
      </div>
    </div>
  );
}
