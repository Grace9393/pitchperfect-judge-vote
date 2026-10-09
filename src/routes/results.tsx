import { createFileRoute } from "@tanstack/react-router";
import { Trophy } from "lucide-react";
import { ResultsView } from "@/components/ResultsView";
import { useT } from "@/lib/i18n";
import { computeLeaderboard, useHubData } from "@/lib/hub";

export const Route = createFileRoute("/results")({
  head: () => ({
    meta: [
      { title: "Live Results — Hack for Humanity Taiwan" },
      { name: "description", content: "Winners and per-track leaderboards for Hack for Humanity Taiwan, updated live." },
      { property: "og:title", content: "Live Results — Hack for Humanity Taiwan" },
      { property: "og:description", content: "1st, 2nd and 3rd place plus per-track standings." },
    ],
  }),
  component: ResultsPage,
});

function ResultsPage() {
  const { t } = useT();
  const { teams, tracks, state, results } = useHubData();
  if (!state) return null;
  const board = computeLeaderboard(teams, results, state.weights);

  if (!results?.can_see)
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center px-4 text-center">
        <Trophy className="h-16 w-16 text-primary" />
        <h1 className="mt-6 text-4xl font-bold sm:text-6xl">{t("appName")}</h1>
        <p className="mt-4 text-xl text-muted-foreground">{t("resultsSoon")}</p>
        <p className="mt-8 text-lg">{results?.total_votes ?? 0} audience votes cast</p>
      </div>
    );

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <ResultsView board={board} tracks={tracks} />
    </div>
  );
}
