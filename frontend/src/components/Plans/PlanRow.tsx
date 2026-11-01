import { useState } from "react";
import { Link } from "react-router";
import { PLAN_ID } from "../../config";
import { useDeletePlan } from "../../lib/api/mutations";
import type { PlanSummary } from "../../lib/api/types";
import { fill, formatDateTime, plural } from "../../lib/i18n/format";
import { useLanguage } from "../../lib/i18n/LanguageProvider";

const SMALL_BUTTON =
  "inline-flex items-center rounded border px-3 py-1.5 font-body text-sm font-semibold transition-colors disabled:opacity-50";
const QUIET = `${SMALL_BUTTON} border-forest-dark/30 text-forest-dark hover:bg-forest-dark/[0.06]`;
const DANGER = `${SMALL_BUTTON} border-error/60 text-error hover:bg-error/[0.06]`;

// One plan: its name links to the editor. Deleting cannot be undone, so it
// asks first, in the row itself.
export default function PlanRow({ plan }: { plan: PlanSummary }) {
  const { lang, t } = useLanguage();
  const remove = useDeletePlan();
  const [confirming, setConfirming] = useState(false);
  const editUrl = `/plans/${plan.id}/edit`;
  const zones = plural(lang, plan.zoneCount, {
    one: t.plans.zonesOne,
    few: t.plans.zonesFew,
    many: t.plans.zonesMany,
    other: t.plans.zonesOther,
  });

  return (
    <li className="flex flex-col gap-sm border-b border-forest-dark/10 py-md sm:flex-row sm:items-center sm:justify-between">
      <div>
        <Link to={editUrl} className="font-display text-card-title text-forest-dark hover:underline">
          {plan.name}
        </Link>
        <p className="mt-1 font-body text-sm text-ink/60">
          {zones} · {fill(t.plans.changed, { date: formatDateTime(lang, plan.updatedAt) })}
          {plan.id === PLAN_ID && (
            <span className="ml-2 rounded-full bg-gold/20 px-2 py-0.5 text-xs font-semibold text-gold-dark">
              {t.plans.onShowcase}
            </span>
          )}
        </p>
      </div>

      {confirming ? (
        <div role="group" aria-label={t.plans.delete} className="flex flex-wrap items-center gap-xs sm:justify-end">
          <p className="font-body text-sm text-ink sm:max-w-[22rem]">{fill(t.plans.deleteConfirm, { name: plan.name })}</p>
          <button
            type="button"
            className={DANGER}
            disabled={remove.isPending}
            onClick={() => remove.mutate(plan.id, { onError: () => setConfirming(false) })}
          >
            {t.plans.deleteYes}
          </button>
          {/* Focused first: the safe choice */}
          <button
            type="button"
            className={QUIET}
            autoFocus
            disabled={remove.isPending}
            onClick={() => setConfirming(false)}
          >
            {t.plans.deleteNo}
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-xs">
          <Link to={editUrl} className={QUIET}>
            {t.plans.edit}
          </Link>
          <button type="button" className={DANGER} onClick={() => setConfirming(true)}>
            {t.plans.delete}
          </button>
          {remove.isError && (
            <p role="alert" className="font-body text-sm text-error">
              {t.plans.deleteError}
            </p>
          )}
        </div>
      )}
    </li>
  );
}
