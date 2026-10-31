import type { Translations } from "../../lib/i18n/translations";
import Button from "../Button/Button";
import { PAPER_SHEET_CLASS } from "./SpaceMapperPlan";

interface PlanStatusProps {
  t: Translations;
  error: boolean;
  onRetry: () => void;
}

// Stands in for the plan while it loads or when it could not be loaded: a
// blank sheet where the plan will be, in the same frame, with the panel's
// column kept free on wide screens. The plan's size is unknown until it
// arrives, so the sheet takes the demo office's 4:3.
export default function PlanStatus({ t, error, onRetry }: PlanStatusProps) {
  return (
    <div className="mt-lg flex flex-col items-start gap-md lg:flex-row">
      <div className="w-full lg:min-w-0 lg:flex-1">
        <div
          className={`${PAPER_SHEET_CLASS} flex aspect-[4/3] flex-col items-center justify-center gap-md p-md text-center`}
          style={{ transform: "rotate(-0.4deg)" }}
        >
          {error ? (
            <div role="alert" className="flex flex-col items-center gap-md">
              <p className="font-marker text-[22px] text-ink">{t.map.loadError}</p>
              <Button type="button" variant="secondary" onClick={onRetry}>
                {t.map.retry}
              </Button>
            </div>
          ) : (
            <p role="status" className="font-marker text-[20px] text-ink/60">
              {t.map.loading}
            </p>
          )}
        </div>
      </div>
      <div aria-hidden="true" className="hidden lg:block lg:w-[300px] lg:flex-none" />
    </div>
  );
}
