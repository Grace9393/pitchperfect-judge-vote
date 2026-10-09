import { Link } from "@tanstack/react-router";
import { useT } from "@/lib/i18n";

export function SiteHeader() {
  const { t, lang, setLang } = useT();
  const links = [
    { to: "/judge", k: "judge" },
    { to: "/vote", k: "vote" },
    { to: "/results", k: "results" },
    { to: "/admin", k: "admin" },
  ] as const;
  return (
    <header className="border-b bg-card">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <Link to="/" className="min-w-0">
          <div className="text-base font-semibold leading-tight sm:text-lg">
            {t("appName")} <span className="text-primary">· {t("hub")}</span>
          </div>
          <div className="text-xs text-muted-foreground">{t("dateLine")}</div>
        </Link>
        <div className="flex items-center gap-1">
          <nav className="flex gap-1 text-sm">
            {links.map((l) => (
              <Link key={l.to} to={l.to} className="rounded-md px-2.5 py-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                activeProps={{ className: "bg-muted text-foreground font-medium" }}>
                {t(l.k)}
              </Link>
            ))}
          </nav>
          <button onClick={() => setLang(lang === "en" ? "zh" : "en")}
            className="ml-1 rounded-md border px-2.5 py-1.5 text-sm font-medium hover:bg-muted" aria-label="Toggle language">
            {lang === "en" ? "繁中" : "EN"}
          </button>
        </div>
      </div>
    </header>
  );
}
