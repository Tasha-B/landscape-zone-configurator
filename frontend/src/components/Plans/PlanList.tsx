import { usePlans } from "../../lib/api/plans";
import { useLanguage } from "../../lib/i18n/LanguageProvider";
import Button from "../Button/Button";
import PlanRow from "./PlanRow";

// Every plan, oldest first (the API's order), so the demo office leads
export default function PlanList() {
  const { t } = useLanguage();
  const { data: plans, isPending, isError, isFetching, refetch } = usePlans();

  if (isPending) {
    return (
      <p role="status" className="mt-lg font-body text-body text-ink/60">
        {t.plans.loading}
      </p>
    );
  }
  if (isError) {
    return (
      <div role="alert" className="mt-lg flex flex-col items-start gap-sm">
        <p className="font-body text-body text-ink">{t.plans.loadError}</p>
        <Button type="button" variant="secondary" disabled={isFetching} onClick={() => void refetch()}>
          {t.plans.retry}
        </Button>
      </div>
    );
  }
  if (plans.length === 0) {
    return <p className="mt-lg font-body text-body text-ink/60">{t.plans.empty}</p>;
  }
  return (
    <ul aria-label={t.plans.listLabel} className="mt-lg border-t border-forest-dark/10">
      {plans.map((plan) => (
        <PlanRow key={plan.id} plan={plan} />
      ))}
    </ul>
  );
}
