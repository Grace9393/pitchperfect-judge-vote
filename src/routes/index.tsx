import { createFileRoute, Link } from "@tanstack/react-router";
import { Send, Gavel, Vote, LayoutDashboard, Trophy } from "lucide-react";
import { Card } from "@/components/ui/card";
import { useT } from "@/lib/i18n";
import { eventName, eventDateLine, useActiveEvent } from "@/lib/events";
import { Button } from "@/components/ui/button";
import { PHASES, useHubData } from "@/lib/hub";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Event Judging Hub: Judging Hub" },
      { name: "description", content: "Live judging, audience voting and results for Event Judging Hub." },
      { property: "og:title", content: "Event Judging Hub: Judging Hub" },
      { property: "og:description", content: "Live judging, audience voting and results." },
    ],
  }),
  component: Index,
});

function Index() {
  const { t, lang } = useT();
  const { state } = useHubData();
  const event = useActiveEvent();
  const phase = PHASES.find((p) => p.key === state?.phase);
  const cards = [
    { to: "/submit", icon: Send, k: "submitNav", d: "submitDesc" },
    { to: "/judge", icon: Gavel, k: "judge", d: "judgeDesc" },
    { to: "/vote", icon: Vote, k: "vote", d: "voteDesc" },
    { to: "/results", icon: Trophy, k: "results", d: "resultsDesc" },
    { to: "/admin", icon: LayoutDashboard, k: "admin", d: "adminDesc" },
  ] as const;
  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <div className="text-center">
        {phase && <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium">{lang === "zh" ? phase.zh : phase.en}</span>}
        <h1 className="mt-4 text-3xl font-bold sm:text-4xl">{eventName(event, lang)}: {t("hub")}</h1>
        <p className="mt-2 text-muted-foreground">{eventDateLine(event, lang)}</p>
        <Button asChild variant="link" className="mt-3"><Link to="/guide">{lang === "zh" ? "評審與隊伍指南" : "Judge & team guide"}</Link></Button>
        <p className="mt-6 text-sm font-medium">{t("pickRole")}</p>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {cards.map((c) => (
          <Link key={c.to} to={c.to}>
            <Card className="flex h-full items-center gap-4 p-5 transition hover:border-primary">
              <c.icon className="h-8 w-8 text-primary" />
              <div>
                <div className="font-semibold">{t(c.k)}</div>
                <div className="text-sm text-muted-foreground">{t(c.d)}</div>
              </div>
            </Card>
          </Link>
        ))}
      </div>
      <p className="mt-10 text-center text-xs text-muted-foreground">{event?.organizer}{event?.partner && ` · ${lang === "zh" ? "官方合作夥伴" : "Official partner"}: ${event.partner}`}</p>
    </div>
  );
}
