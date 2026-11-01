import { useLanguage } from "../lib/i18n/LanguageProvider";
import PageMain from "./PageMain";

// The list of plans: create, open, delete (step 4 of phase 6)
export default function PlansPage() {
  const { t } = useLanguage();
  return <PageMain title={t.plans.title} />;
}
