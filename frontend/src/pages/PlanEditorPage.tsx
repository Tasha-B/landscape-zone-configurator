import { useParams } from "react-router";
import PlanEditor from "../components/PlanEditor/PlanEditor";
import { useLanguage } from "../lib/i18n/LanguageProvider";
import PageMain from "./PageMain";

// The editor of one plan
export default function PlanEditorPage() {
  const { t } = useLanguage();
  const { id = "" } = useParams();
  return (
    <PageMain title={t.editor.title}>
      {/* A new id starts a fresh editor: no selection or drag carried over */}
      <PlanEditor key={id} planId={id} />
    </PageMain>
  );
}
