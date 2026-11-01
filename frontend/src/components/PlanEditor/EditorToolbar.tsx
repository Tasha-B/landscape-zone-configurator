import { useEffect, useRef } from "react";
import { useRovingTabIndex } from "../../lib/a11y/roving";
import type { NewShapeKind } from "../../lib/editor/newZone";
import { fill } from "../../lib/i18n/format";
import type { Translations } from "../../lib/i18n/translations";

const BUTTON =
  "inline-flex items-center rounded border px-3 py-1.5 font-body text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40";
const QUIET = `${BUTTON} border-forest-dark/30 text-forest-dark hover:bg-forest-dark/[0.06]`;
const DANGER = `${BUTTON} border-error/60 text-error hover:bg-error/[0.06]`;

interface EditorToolbarProps {
  t: Translations;
  onAdd: (kind: NewShapeKind) => void;
  // The selected zone's name, or null
  selectedName: string | null;
  confirmingDelete: boolean;
  onDeleteRequest: () => void;
  onDeleteConfirm: () => void;
  onDeleteCancel: () => void;
  status: string;
  // Shown with the status while the server cannot be reached
  onRetry?: () => void;
}

// Adding and deleting zones, and whether the changes are saved. Deleting
// asks first, in the toolbar itself, since nothing can undo it.
export default function EditorToolbar({
  t,
  onAdd,
  selectedName,
  confirmingDelete,
  onDeleteRequest,
  onDeleteConfirm,
  onDeleteCancel,
  status,
  onRetry,
}: EditorToolbarProps) {
  const e = t.editor;
  // Asking moves the focus to Cancel, the safe choice, so Enter does not
  // delete by accident
  const cancelRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (confirmingDelete) cancelRef.current?.focus();
  }, [confirmingDelete]);
  // One stop for Tab; the arrow keys move between the buttons
  const tool = useRovingTabIndex([true, true, true, selectedName !== null]);

  return (
    <div className="mb-sm flex min-h-10 flex-wrap items-center gap-xs">
      {confirmingDelete && selectedName !== null ? (
        <div role="group" aria-label={e.deleteZone} className="flex flex-wrap items-center gap-xs">
          <p className="font-body text-sm text-ink">{fill(e.deleteConfirm, { name: selectedName })}</p>
          <button type="button" className={DANGER} onClick={onDeleteConfirm}>
            {e.deleteYes}
          </button>
          <button ref={cancelRef} type="button" className={QUIET} onClick={onDeleteCancel}>
            {e.deleteNo}
          </button>
        </div>
      ) : (
        <div role="toolbar" aria-label={e.toolbarLabel} className="flex flex-wrap items-center gap-xs">
          <button type="button" className={QUIET} {...tool(0)} onClick={() => onAdd("rect")}>
            {e.addRect}
          </button>
          <button type="button" className={QUIET} {...tool(1)} onClick={() => onAdd("circle")}>
            {e.addCircle}
          </button>
          <button type="button" className={QUIET} {...tool(2)} onClick={() => onAdd("polygon")}>
            {e.addPolygon}
          </button>
          <button
            type="button"
            className={DANGER}
            {...tool(3)}
            disabled={selectedName === null}
            onClick={onDeleteRequest}
          >
            {e.deleteZone}
          </button>
        </div>
      )}
      <p role="status" className="ml-auto font-body text-sm text-ink/60">
        {status}
      </p>
      {onRetry && (
        <button type="button" className={QUIET} onClick={onRetry}>
          {t.editor.retry}
        </button>
      )}
    </div>
  );
}
