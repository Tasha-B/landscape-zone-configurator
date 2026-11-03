import { useState } from "react";
import { Link } from "react-router";
import { ApiError } from "../../lib/api/client";
import { usePlanLive } from "../../lib/api/live";
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
  const live = usePlanLive(planId);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  // For the status line: whether anything was changed yet, and how the last
  // save failed or that the selected zone was deleted elsewhere (cleared by
  // the next change)
  const [changed, setChanged] = useState(false);
  const [notice, setNotice] = useState<SaveErrorKind | "zoneGone" | null>(null);
  // How many selected zones were deleted elsewhere
  const [zonesGone, setZonesGone] = useState(0);
  const [saveErrors, setSaveErrors] = useState(0);
  const edits = usePlanEdits(planId, {
    onSaveError: (kind) => {
      setNotice(kind);
      setSaveErrors((count) => count + 1);
    },
  });

  // Without a plan yet: loading, or why it could not be loaded. Once there is
  // one, a failed reload (the server went away) keeps it on screen and only
  // the status line says so, unless the answer is that the plan is gone.
  const missing = error instanceof ApiError && (error.status === 404 || error.status === 400);
  if (!plan || missing) {
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

  // A selected zone that is gone was deleted elsewhere: this editor's own
  // delete clears the selection, and a new zone is in the cache before it is
  // selected. Adjusted during render, as React recommends for state that
  // follows props.
  if (!selected && selectedId !== null) {
    setSelectedId(null);
    setConfirmingDelete(false);
    setNotice("zoneGone");
    setZonesGone((count) => count + 1);
  }

  function startChange() {
    setChanged(true);
    setNotice(null);
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

  const offline = isError;
  // What holds now comes before what happened last
  const status = saving
    ? e.saving
    : offline
      ? e.offline
      : live === "lost"
        ? e.livePaused
        : notice === "conflict"
          ? e.conflict
          : notice === "failed"
            ? e.saveFailed
            : notice === "zoneGone"
              ? e.zoneGone
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
            onRetry={offline && !isFetching ? () => void refetch() : undefined}
            zonesGone={zonesGone}
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
