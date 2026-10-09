import { Card } from "@/components/ui/card";
import { useT } from "@/lib/i18n";
import { trackName, type Ranked, type Track } from "@/lib/hub";

export function ResultsView({ board, tracks }: { board: Ranked[]; tracks: Track[] }) {
  const { t, lang } = useT();
  const places = [t("place1"), t("place2"), t("place3")];
  return (
    <div className="space-y-10">
      <h1 className="text-center text-3xl font-bold sm:text-5xl">{t("winners")}</h1>
      <div className="grid gap-4 md:grid-cols-3">
        {board.slice(0, 3).map((r, i) => (
          <Card key={r.team.id} className={`p-6 text-center ${i === 0 ? "border-2 border-primary md:order-2 md:scale-105" : i === 1 ? "md:order-1" : "md:order-3"}`}>
            <div className="text-sm font-semibold uppercase tracking-widest text-primary">{places[i]}</div>
            <div className="mt-3 text-3xl font-bold">{r.team.name}</div>
            <div className="text-lg text-muted-foreground">{r.team.project_name}</div>
            <div className="mt-2 text-sm text-muted-foreground">{trackName(tracks.find((x) => x.id === r.team.track_id), lang)}</div>
            <div className="mt-4 text-5xl font-bold tabular-nums">{r.combined.toFixed(1)}</div>
            <div className="mt-1 text-xs text-muted-foreground">{t("judgeScore")} {r.judgeScore.toFixed(1)} · {t("audienceScore")} {r.audienceScore.toFixed(1)}</div>
          </Card>
        ))}
      </div>
      <h2 className="text-center text-2xl font-semibold">{t("perTrack")}</h2>
      <div className="grid gap-4 md:grid-cols-2">
        {tracks.map((tr) => {
          const rows = board.filter((r) => r.team.track_id === tr.id);
          return (
            <Card key={tr.id} className="p-5">
              <h3 className="font-semibold">{trackName(tr, lang)}</h3>
              <ol className="mt-3 space-y-2">
                {rows.length === 0 && <li className="text-sm text-muted-foreground">—</li>}
                {rows.map((r, i) => (
                  <li key={r.team.id} className="flex items-center justify-between gap-2">
                    <span><span className="mr-2 text-muted-foreground">{i + 1}.</span>{r.team.name}</span>
                    <span className="font-mono tabular-nums">{r.combined.toFixed(1)}</span>
                  </li>
                ))}
              </ol>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
