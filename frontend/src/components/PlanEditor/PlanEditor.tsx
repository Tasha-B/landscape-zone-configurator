import { useState } from "react";
import { Link } from "react-router";
import { ApiError } from "../../lib/api/client";
import { useEditedPlan, usePlanEdits, type SaveErrorKind } from "../../lib/api/mutations";
import type { PlanChanges, ZoneChanges } from "../../lib/api/types";
import { newZoneBody, type NewShapeKind } from "../../lib/editor/newZone";
import { fill } from "../../lib/i18n/format";
import { useLanguage } from "../../lib/i18n/LanguageProvider";
import PageMain from "../../pages/PageMain";
import Button from "../Button/Button";
import { PAPER_SHEET_CLASS } from "../SpaceMapper/SpaceMapperPlan";
import EditorCanvas from "./EditorCanvas";
import EditorToolbar from "./EditorToolbar";
import PlanPanel from "./PlanPanel";
import ZonePanel from "./ZonePanel";

const BACK_LINK = "font-body text-sm font-semibold text-forest-dark underline-offset-4 hover:underline";

// The editor of one plan. The plan shown is the server's with the changes
// still being saved on top; each change is saved as soon as it is made.
export default function PlanEditor({ planId }: { planId: string }) {
  const { lang, t } = useLanguage();
  const e = t.editor;
  const { data: plan, isPending, isError, error, isFetching, refetch, saving } = useEditedPlan(planId);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  // For the status line: whether anything was changed yet, and how the last
  // failed save failed (cleared by the next change)
  const [changed, setChanged] = useState(false);
  const [lastError, setLastError] = useState<SaveErrorKind | null>(null);
  const [saveErrors, setSaveErrors] = useState(0);
  const edits = usePlanEdits(planId, {
    onSaveError: (kind) => {
      setLastError(kind);
      setSaveErrors((count) => count + 1);
    },
  });

  if (isPending || isError || !plan) {
    const missing = error instanceof ApiError && (error.status === 404 || error.status === 400);
    return (
      <PageMain title={e.title}>
        {isPending ? (
          <p role="status" className="mt-md font-body text-body text-ink/60">
            {e.loading}
          </p>
        ) : (
          <div role="alert" className="mt-md flex flex-col items-start gap-sm">
            <p className="font-body text-body text-ink">{missing ? e.notFound : e.loadError}</p>
            {missing ? (
              <Link to="/plans" className={BACK_LINK}>
                {e.back}
              </Link>
            ) : (
              <Button type="button" variant="secondary" disabled={isFetching} onClick={() => void refetch()}>
                {e.retry}
              </Button>
            )}
          </div>
        )}
      </PageMain>
    );
  }

  const selected = plan.zones.find((zone) => zone.id === selectedId) ?? null;

  function startChange() {
    setChanged(true);
    setLastError(null);
  }
  const changeZone = (zoneId: string, changes: ZoneChanges) => {
    startChange();
    edits.updateZone(zoneId, changes);
  };
  const changePlan = (changes: PlanChanges) => {
    startChange();
    edits.updatePlan(changes);
  };
  // The new zone is selected once the server has given it an id; a failure
  // is reported through onSaveError
  const addZone = (kind: NewShapeKind) => {
    startChange();
    setConfirmingDelete(false);
    edits
      .createZone(newZoneBody(kind, plan.viewBox, plan.zones))
      .then((zone) => setSelectedId(zone.id))
      .catch(() => {});
  };
  const deleteSelected = () => {
    if (!selected) return;
    startChange();
    edits.deleteZone(selected.id);
    setSelectedId(null);
    setConfirmingDelete(false);
  };
  const select = (zoneId: string | null) => {
    if (zoneId !== selectedId) setConfirmingDelete(false);
    setSelectedId(zoneId);
  };

  const status = saving
    ? e.saving
    : lastError === "conflict"
      ? e.conflict
      : lastError === "failed"
        ? e.saveFailed
        : changed
          ? e.saved
          : "";

  return (
    <PageMain title={plan.name}>
      <Link to="/plans" className={`${BACK_LINK} mt-xs inline-block`}>
        {e.back}
      </Link>
      <p className="mt-xs hidden max-w-[48rem] font-body text-sm text-ink/60 md:block">{e.help}</p>

      {/* Under 768 px there is no room for the sheet and the panel */}
      <p className="mt-md font-body text-body text-ink md:hidden">{e.smallScreen}</p>

      <div className="mt-md hidden flex-col gap-md md:flex lg:flex-row lg:items-start">
        <div className="min-w-0 lg:flex-1">
          <EditorToolbar
            t={t}
            onAdd={addZone}
            selectedName={selected ? selected.content[lang].name : null}
            confirmingDelete={confirmingDelete}
            onDeleteRequest={() => setConfirmingDelete(true)}
            onDeleteConfirm={deleteSelected}
            onDeleteCancel={() => setConfirmingDelete(false)}
            status={status}
          />
          <div className={`${PAPER_SHEET_CLASS} p-sm`}>
            <EditorCanvas
              plan={plan}
              lang={lang}
              label={fill(e.canvasLabel, { name: plan.name })}
              selectedId={selected?.id ?? null}
              onSelect={select}
              onShapeChange={(zoneId, shape) => changeZone(zoneId, { shape })}
              onDeleteRequest={() => setConfirmingDelete(true)}
              saveErrors={saveErrors}
            />
          </div>
        </div>

        <aside className="lg:w-[340px] lg:flex-none">
          {selected ? (
            <ZonePanel
              zone={selected}
              lang={lang}
              t={t}
              onChange={(changes) => changeZone(selected.id, changes)}
            />
          ) : (
            <PlanPanel plan={plan} t={t} onChange={changePlan} />
          )}
        </aside>
      </div>
    </PageMain>
  );
}
