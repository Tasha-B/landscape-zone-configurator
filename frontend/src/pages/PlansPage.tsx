import NewPlanForm from "../components/Plans/NewPlanForm";
import PlanList from "../components/Plans/PlanList";
import { useLanguage } from "../lib/i18n/LanguageProvider";
import PageMain from "./PageMain";

// Create, open and delete plans
export default function PlansPage() {
  const { t } = useLanguage();
  return (
    <PageMain title={t.plans.title}>
      <p className="mt-sm max-w-[36rem] font-body text-body text-ink/70">{t.plans.intro}</p>
      <NewPlanForm />
      <PlanList />
    </PageMain>
  );
}
