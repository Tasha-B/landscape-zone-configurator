import { Link } from "react-router";
import { useLanguage } from "../lib/i18n/LanguageProvider";
import PageMain from "./PageMain";

export default function NotFoundPage() {
  const { t } = useLanguage();
  return (
    <PageMain title={t.notFound.title}>
      <Link to="/" className="mt-md inline-block font-body text-body text-forest-dark underline underline-offset-4">
        {t.notFound.back}
      </Link>
    </PageMain>
  );
}
