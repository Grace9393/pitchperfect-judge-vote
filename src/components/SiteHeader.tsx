import { Link } from "@tanstack/react-router";
import { useT } from "@/lib/i18n";
import { eventName, eventDateLine, useActiveEvent } from "@/lib/events";
import { Button } from "@/components/ui/button";

export function SiteHeader() {
  const { t, lang, setLang } = useT();
  const event = useActiveEvent();
  const links = [
    { to: "/guide", k: "guide" },
    { to: "/submit", k: "submitNav" },
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
            {eventName(event, lang)} <span className="text-primary">· {t("hub")}</span>
          </div>
          <div className="text-xs text-muted-foreground">{eventDateLine(event, lang)}</div>
        </Link>
        <div className="flex max-w-full flex-wrap items-center gap-1">
          <nav className="flex flex-wrap gap-1 text-sm">
            {links.map((l) => (
              <Link key={l.to} to={l.to} className="rounded-md px-2.5 py-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                activeProps={{ className: "bg-muted text-foreground font-medium" }}>
                {t(l.k)}
              </Link>
            ))}
          </nav>
          <Button variant="outline" size="sm" onClick={() => setLang(lang === "en" ? "zh" : "en")}
            className="ml-1 rounded-md border px-2.5 py-1.5 text-sm font-medium hover:bg-muted" aria-label="Toggle language">
            {lang === "en" ? "繁中" : "EN"}
          </Button>
        </div>
      </div>
    </header>
  );
}
