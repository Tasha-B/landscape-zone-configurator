import { NavLink } from "react-router";
import { useLanguage } from "../../lib/i18n/LanguageProvider";

const LINK = "font-body text-sm font-semibold underline-offset-4 transition-colors";
const ACTIVE = "text-forest-dark underline decoration-gold decoration-2";
const IDLE = "text-ink/60 hover:text-forest-dark";

// A thin row above every page: the showcase and the plans. The editor is
// reached from the plans page.
export default function Header() {
  const { t } = useLanguage();
  const linkClass = ({ isActive }: { isActive: boolean }) => `${LINK} ${isActive ? ACTIVE : IDLE}`;

  return (
    <header className="mx-auto max-w-content px-sm pt-md sm:px-md">
      <nav aria-label={t.nav.label} className="flex gap-md">
        <NavLink to="/" end className={linkClass}>
          {t.nav.showcase}
        </NavLink>
        <NavLink to="/plans" className={linkClass}>
          {t.nav.plans}
        </NavLink>
      </nav>
    </header>
  );
}
