import { useParams } from "react-router";
import { useLanguage } from "../lib/i18n/LanguageProvider";
import PageMain from "./PageMain";

// The editor of one plan (steps 5 and 6 of phase 6)
export default function PlanEditorPage() {
  const { t } = useLanguage();
  const { id } = useParams();
  return (
    <PageMain title={t.editor.title}>
      <p className="mt-sm font-body text-body text-ink/60">{id}</p>
    </PageMain>
  );
}
