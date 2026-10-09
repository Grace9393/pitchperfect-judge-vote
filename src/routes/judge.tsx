import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { CodeGate } from "@/components/CodeGate";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useT } from "@/lib/i18n";
import { CRITERIA, errMsg, normalizeWeights, trackName, useHubData, useStoredCode, weightedScore, type CriterionKey, type ScoreRow } from "@/lib/hub";

export const Route = createFileRoute("/judge")({
  head: () => ({
    meta: [
      { title: "Judge Scoring — Hack for Humanity Taiwan" },
      { name: "description", content: "Judges score live pitches at Hack for Humanity Taiwan with a 90-second timer." },
      { property: "og:title", content: "Judge Scoring — Hack for Humanity Taiwan" },
      { property: "og:description", content: "Live pitch scoring for Hack for Humanity Taiwan judges." },
    ],
  }),
  component: JudgePage,
});

function Timer({ serverStart }: { serverStart: string | null }) {
  const { t } = useT();
  const [localStart, setLocalStart] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(i);
  }, []);
  useEffect(() => setLocalStart(null), [serverStart]);
  const start = localStart ?? (serverStart ? new Date(serverStart).getTime() : null);
  const left = start ? Math.max(0, 90 - Math.floor((now - start) / 1000)) : 90;
  const pct = (left / 90) * 100;
  return (
    <Card className="flex items-center gap-4 p-4">
      <div className={`font-mono text-4xl font-bold tabular-nums ${left <= 10 && start ? "text-destructive" : ""}`}>
        {Math.floor(left / 60)}:{String(left % 60).padStart(2, "0")}
      </div>
      <div className="flex-1">
        <div className="text-xs text-muted-foreground">{t("timer")}</div>
        <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
          <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>
      <Button size="sm" onClick={() => setLocalStart(Date.now())}>{t("start")}</Button>
      <Button size="sm" variant="outline" onClick={() => setLocalStart(Number.MAX_SAFE_INTEGER)}>{t("reset")}</Button>
    </Card>
  );
}

function JudgePage() {
  const { t, lang } = useT();
  const [code, setCode, ready] = useStoredCode("hfh-judge");
  const [judge, setJudge] = useState<{ id: string; name: string } | null>(null);
  const { state, teams, tracks } = useHubData();
  const qc = useQueryClient();

  useEffect(() => {
    if (!code) return;
    supabase.rpc("judge_login", { p_code: code }).then(({ data }) => {
      if (data) setJudge(data as { id: string; name: string });
      else setCode(null);
    });
  }, [code]);

  const mine = useQuery({
    queryKey: ["hub", "mine", code],
    enabled: !!code,
    queryFn: async () => ((await supabase.rpc("judge_my_scores", { p_code: code! })).data ?? []) as unknown as ScoreRow[],
  });

  const team = teams.find((x) => x.id === state?.current_team_id);
  const existing = mine.data?.find((s) => s.team_id === team?.id);
  const [vals, setVals] = useState<Partial<Record<CriterionKey, number>>>({});
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setVals(existing ? Object.fromEntries(CRITERIA.map((c) => [c.key, existing[c.key]])) : {});
  }, [team?.id, existing?.locked]);

  const weights = state?.weights;
  const norm = useMemo(() => (weights ? normalizeWeights(weights) : null), [weights]);
  const complete = CRITERIA.every((c) => vals[c.key]);

  if (!ready) return null;
  if (!code || !judge)
    return (
      <CodeGate title={`${t("judge")} · ${t("hub")}`} label={t("enterCode")} cta={t("continue")}
        onSubmit={async (c) => {
          const { data } = await supabase.rpc("judge_login", { p_code: c });
          if (!data) return t("invalidCode");
          setCode(c.toUpperCase());
          return null;
        }} />
    );

  const submit = async () => {
    if (!team || !complete) return;
    setBusy(true);
    const { error } = await supabase.rpc("submit_score", {
      p_code: code, p_team: team.id, p_problem: vals.problem!, p_impact: vals.impact!,
      p_execution: vals.execution!, p_data: vals.data!, p_clarity: vals.clarity!,
    });
    setBusy(false);
    if (error) toast.error(errMsg(error));
    else {
      toast.success(t("submitted"));
      qc.invalidateQueries({ queryKey: ["hub"] });
    }
  };

  const track = tracks.find((x) => x.id === team?.track_id);
  const locked = !!existing?.locked;

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 py-6">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">{t("judge")}: <span className="font-medium text-foreground">{judge.name}</span></div>
        <Button variant="ghost" size="sm" onClick={() => { setCode(null); setJudge(null); }}>{t("signOut")}</Button>
      </div>

      {!team ? (
        <Card className="p-10 text-center">
          <div className="mx-auto mb-4 h-3 w-3 animate-pulse rounded-full bg-primary" />
          <h2 className="text-xl font-semibold">{t("waiting")}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{t("waitingSub")}</p>
          <p className="mt-6 text-xs text-muted-foreground">{t("yourScores")}: {mine.data?.filter((s) => s.locked).length ?? 0} / {teams.length}</p>
        </Card>
      ) : (
        <>
          <Card className="p-5">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">{t("nowPitching")}</div>
            <h2 className="mt-1 text-2xl font-semibold">{team.name} <span className="text-muted-foreground">· {team.project_name}</span></h2>
            <p className="mt-1">{team.description}</p>
            <div className="mt-3 flex flex-wrap gap-2 text-sm">
              <Badge variant="secondary">{trackName(track, lang)}</Badge>
              <Badge variant="outline">{t("table")} {team.table_number}</Badge>
              {team.built_with_lovable && <Badge>{t("builtWithLovable")}</Badge>}
              {team.deck_url && <a href={team.deck_url} target="_blank" rel="noreferrer" className="text-primary underline">{t("deck")}</a>}
            </div>
            <p className="mt-2 text-sm text-muted-foreground">{t("members")}: {team.members}</p>
            {track && <p className="mt-2 text-xs text-muted-foreground"><span className="font-medium">{t("dataSources")}:</span> {track.data_sources}</p>}
          </Card>

          <Timer serverStart={state?.timer_started_at ?? null} />

          {!state?.scoring_open && !locked && <Card className="p-4 text-center text-sm text-muted-foreground">{t("scoringClosed")}</Card>}

          <div className="space-y-3">
            {CRITERIA.map((c) => (
              <Card key={c.key} className="p-4">
                <div className="flex items-baseline justify-between gap-2">
                  <div className="font-medium">{lang === "zh" ? c.zh : c.en}</div>
                  <div className="text-xs text-muted-foreground">
                    {state?.weights[c.key]}% → {norm ? (norm[c.key] * 100).toFixed(1) : "–"}%
                  </div>
                </div>
                <p className="mt-0.5 text-sm text-muted-foreground">{lang === "zh" ? c.descZh : c.descEn}</p>
                <div className="mt-3 grid grid-cols-10 gap-1">
                  {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                    <button key={n} disabled={locked || !state?.scoring_open}
                      onClick={() => setVals((v) => ({ ...v, [c.key]: n }))}
                      className={`h-11 rounded-md border text-sm font-semibold transition disabled:opacity-60 ${vals[c.key] === n ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:bg-muted"}`}>
                      {n}
                    </button>
                  ))}
                </div>
              </Card>
            ))}
          </div>

          <Card className="sticky bottom-2 flex items-center justify-between gap-3 p-4 shadow-lg">
            <div>
              <div className="text-xs text-muted-foreground">{t("weightedTotal")}</div>
              <div className="text-2xl font-bold tabular-nums">
                {complete && weights ? weightedScore(vals as Record<CriterionKey, number>, weights).toFixed(1) : "–"}<span className="text-sm text-muted-foreground"> / 100</span>
              </div>
            </div>
            {locked ? <Badge className="px-3 py-1.5">{t("locked")}</Badge> : (
              <Button className="h-11" disabled={!complete || busy || !state?.scoring_open} onClick={submit}>{t("submit")}</Button>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
