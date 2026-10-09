import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { CodeGate } from "@/components/CodeGate";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useT } from "@/lib/i18n";
import {
  CRITERIA, PHASES, computeLeaderboard, errMsg, normalizeWeights, trackName, useHubData, useStoredCode, weightedScore,
  type Team, type Weights,
} from "@/lib/hub";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Organizer Dashboard — Hack for Humanity Taiwan" },
      { name: "description", content: "Run phases, teams, scoring, voting and results for Hack for Humanity Taiwan." },
      { property: "og:title", content: "Organizer Dashboard — Hack for Humanity Taiwan" },
      { property: "og:description", content: "Event control room for the Hack for Humanity Taiwan judging hub." },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  const { t } = useT();
  const [code, setCode, ready] = useStoredCode("hfh-admin");
  const [ok, setOk] = useState(false);
  useEffect(() => {
    if (!code) return;
    supabase.rpc("admin_login", { p_code: code }).then(({ data }) => (data ? setOk(true) : setCode(null)));
  }, [code]);
  if (!ready) return null;
  if (!code || !ok)
    return (
      <CodeGate title={t("admin")} label={t("enterCode")} cta={t("continue")}
        onSubmit={async (c) => {
          const { data } = await supabase.rpc("admin_login", { p_code: c });
          if (!data) return t("invalidCode");
          setCode(c);
          return null;
        }} />
    );
  return <Dashboard code={code} onSignOut={() => { setCode(null); setOk(false); }} />;
}

function Dashboard({ code, onSignOut }: { code: string; onSignOut: () => void }) {
  const { lang } = useT();
  const hub = useHubData(code);
  const qc = useQueryClient();
  const { state, teams, tracks, judges, results } = hub;

  const call = async (fn: () => PromiseLike<{ error: unknown }>, msg?: string) => {
    const { error } = await fn();
    if (error) toast.error(errMsg(error));
    else if (msg) toast.success(msg);
    qc.invalidateQueries({ queryKey: ["hub"] });
  };
  const patch = (p: Record<string, unknown>, msg?: string) =>
    call(() => supabase.rpc("admin_update_state", { p_code: code, p_patch: p as never }), msg);

  if (!state) return null;
  const board = computeLeaderboard(teams, results, state.weights);
  const current = teams.find((x) => x.id === state.current_team_id);
  const currentIdx = teams.findIndex((x) => x.id === state.current_team_id);

  return (
    <div className="mx-auto max-w-6xl space-y-4 px-4 py-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">Organizer dashboard</h1>
        <div className="flex items-center gap-2">
          {state.demo_mode && <Badge variant="destructive">Demo mode</Badge>}
          <Button variant="ghost" size="sm" onClick={onSignOut}>Sign out</Button>
        </div>
      </div>

      <Tabs defaultValue="control">
        <TabsList className="flex h-auto flex-wrap">
          <TabsTrigger value="control">Control</TabsTrigger>
          <TabsTrigger value="teams">Teams</TabsTrigger>
          <TabsTrigger value="scores">Scoring progress</TabsTrigger>
          <TabsTrigger value="board">Leaderboard</TabsTrigger>
          <TabsTrigger value="voters">Voter codes</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="control" className="space-y-4">
          <Card className="p-4">
            <div className="mb-2 text-sm font-medium">Event phase</div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-6">
              {PHASES.map((p) => (
                <Button key={p.key} variant={state.phase === p.key ? "default" : "outline"} className="h-auto py-2"
                  onClick={() => patch({ phase: p.key, ...(p.key === "voting" ? { voting_open: true } : {}), ...(p.key === "pitches" ? { scoring_open: true } : {}) })}>
                  {lang === "zh" ? p.zh : p.en}
                </Button>
              ))}
            </div>
          </Card>
          <div className="grid gap-4 md:grid-cols-3">
            <ToggleCard label="Judge scoring open" checked={state.scoring_open} onChange={(v) => patch({ scoring_open: v })} />
            <ToggleCard label="Audience voting open" checked={state.voting_open} onChange={(v) => patch({ voting_open: v })} />
            <ToggleCard label="Reveal scores (judges + results screen)" checked={state.scores_revealed} onChange={(v) => patch({ scores_revealed: v })} />
          </div>
          <Card className="space-y-3 p-4">
            <div className="text-sm font-medium">Current team on stage</div>
            <div className="text-lg font-semibold">{current ? `${current.name} · ${current.project_name}` : "None — judges see “waiting for next team”"}</div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" disabled={currentIdx <= 0} onClick={() => patch({ current_team_id: teams[currentIdx - 1].id, timer_started_at: "" })}>← Previous</Button>
              <Button disabled={currentIdx >= teams.length - 1} onClick={() => patch({ current_team_id: teams[currentIdx + 1].id, timer_started_at: "" })}>Next team →</Button>
              <Button variant="outline" onClick={() => patch({ current_team_id: "" })}>Clear (waiting)</Button>
              <Button variant="secondary" disabled={!current} onClick={() => patch({ timer_started_at: new Date().toISOString() })}>Start 90s timer for everyone</Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {teams.map((tm) => (
                <Button key={tm.id} size="sm" variant={tm.id === state.current_team_id ? "default" : "outline"}
                  onClick={() => patch({ current_team_id: tm.id, timer_started_at: "" })}>{tm.name}</Button>
              ))}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="teams"><TeamsTab code={code} teams={teams} tracks={tracks} call={call} /></TabsContent>

        <TabsContent value="scores">
          <Card className="overflow-x-auto p-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="py-2">Team</th>
                  {judges.map((j) => <th key={j.id} className="py-2">{j.name}</th>)}
                </tr>
              </thead>
              <tbody>
                {teams.map((tm) => (
                  <tr key={tm.id} className="border-b">
                    <td className="py-2 font-medium">{tm.name}</td>
                    {judges.map((j) => {
                      const s = results?.scores.find((x) => x.judge_id === j.id && x.team_id === tm.id);
                      return (
                        <td key={j.id} className="py-2">
                          {s ? (
                            <div className="flex items-center gap-2">
                              <span className="font-mono">{weightedScore(s, state.weights).toFixed(1)}</span>
                              {s.locked ? (
                                <Button size="sm" variant="ghost" className="h-7 px-2 text-xs"
                                  onClick={() => call(() => supabase.rpc("admin_reopen_score", { p_code: code, p_judge: j.id, p_team: tm.id }), "Reopened")}>Reopen</Button>
                              ) : <Badge variant="outline">reopened</Badge>}
                            </div>
                          ) : <span className="text-muted-foreground">—</span>}
                        </td>
                      );
                    })}
                  </tr>
                ))}
                <tr>
                  <td className="py-2 text-muted-foreground">Submitted</td>
                  {judges.map((j) => (
                    <td key={j.id} className="py-2 font-medium">{results?.progress.filter((p) => p.judge_id === j.id).length ?? 0} / {teams.length}</td>
                  ))}
                </tr>
              </tbody>
            </table>
          </Card>
        </TabsContent>

        <TabsContent value="board" className="space-y-4">
          <Card className="p-4 text-sm text-muted-foreground">
            Judge score = average of each judge's normalized weighted score (0–100). Audience score = votes ÷ highest vote count × 100.
            Total = 0.7 × Judge + 0.3 × Audience. Ties: higher average Impact, then more votes.
          </Card>
          <Card className="overflow-x-auto p-4">
            <table className="w-full text-sm">
              <thead><tr className="border-b text-left"><th className="py-2">#</th><th>Team</th><th>Track</th><th>Judge (n)</th><th>Votes</th><th>Audience</th><th>Calculation</th><th>Total</th></tr></thead>
              <tbody>
                {board.map((r) => (
                  <tr key={r.team.id} className={`border-b ${r.rank <= 3 ? "font-semibold" : ""}`}>
                    <td className="py-2">{r.rank}</td>
                    <td>{r.team.name}{r.team.built_with_lovable && <Badge variant="secondary" className="ml-2">Lovable</Badge>}</td>
                    <td className="text-xs">{trackName(tracks.find((x) => x.id === r.team.track_id), lang)}</td>
                    <td className="font-mono">{r.judgeScore.toFixed(2)} ({r.judgeCount})</td>
                    <td className="font-mono">{r.votes}</td>
                    <td className="font-mono">{r.audienceScore.toFixed(2)}</td>
                    <td className="font-mono text-xs text-muted-foreground">0.7×{r.judgeScore.toFixed(1)} + 0.3×{r.audienceScore.toFixed(1)}</td>
                    <td className="font-mono">{r.combined.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          <div className="grid gap-4 md:grid-cols-2">
            {tracks.map((tr) => (
              <Card key={tr.id} className="p-4">
                <div className="font-medium">{trackName(tr, lang)}</div>
                <ol className="mt-2 space-y-1 text-sm">
                  {board.filter((r) => r.team.track_id === tr.id).map((r, i) => (
                    <li key={r.team.id} className="flex justify-between"><span>{i + 1}. {r.team.name}</span><span className="font-mono">{r.combined.toFixed(2)}</span></li>
                  ))}
                </ol>
              </Card>
            ))}
          </div>
          <Button onClick={() => exportCsv(board, tracks, results, judges, teams, state.weights)}>Export CSV</Button>
        </TabsContent>

        <TabsContent value="voters"><VotersTab code={code} teams={teams} /></TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <WeightsCard weights={state.weights} onSave={(w) => patch({ weights: w }, "Weights saved")} />
          <Card className="space-y-3 p-4">
            <div className="font-medium">Reset</div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => confirm("Delete all judge scores?") && call(() => supabase.rpc("admin_reset", { p_code: code, p_what: "scores" }), "Scores cleared")}>Clear scores</Button>
              <Button variant="outline" onClick={() => confirm("Delete all audience votes?") && call(() => supabase.rpc("admin_reset", { p_code: code, p_what: "votes" }), "Votes cleared")}>Clear votes</Button>
              <Button variant="destructive" onClick={() => confirm("Clear scores, votes and reset the phase?") && call(() => supabase.rpc("admin_reset", { p_code: code, p_what: "all" }), "Event reset")}>Reset everything</Button>
            </div>
          </Card>
          {state.demo_mode && (
            <Card className="space-y-2 border-destructive p-4">
              <div className="font-medium">Demo mode is on</div>
              <p className="text-sm text-muted-foreground">Switching it off permanently removes the 6 demo teams, demo voter codes, and all scores and votes. Do this before the event.</p>
              <Button variant="destructive" onClick={() => confirm("Remove all demo data and switch demo mode off?") && call(() => supabase.rpc("admin_disable_demo", { p_code: code }), "Demo mode off")}>Switch off demo mode</Button>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ToggleCard({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <Card className="flex items-center justify-between gap-3 p-4">
      <span className="text-sm font-medium">{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </Card>
  );
}

function WeightsCard({ weights, onSave }: { weights: Weights; onSave: (w: Weights) => void }) {
  const [w, setW] = useState<Weights>(weights);
  useEffect(() => setW(weights), [weights]);
  const n = normalizeWeights(w);
  const raw = CRITERIA.reduce((s, c) => s + Number(w[c.key] || 0), 0);
  return (
    <Card className="space-y-3 p-4">
      <div className="font-medium">Scoring weights</div>
      <p className="text-sm text-muted-foreground">Raw weights total {raw}%. Each is divided by {raw} to normalize to 100%.</p>
      {CRITERIA.map((c) => (
        <div key={c.key} className="flex items-center gap-3">
          <span className="flex-1 text-sm">{c.en}</span>
          <Input type="number" className="w-20" value={w[c.key]} onChange={(e) => setW({ ...w, [c.key]: Number(e.target.value) })} />
          <span className="w-16 text-right font-mono text-sm">{(n[c.key] * 100).toFixed(2)}%</span>
        </div>
      ))}
      <Button onClick={() => onSave(w)}>Save weights</Button>
    </Card>
  );
}

const emptyTeam = { id: "", name: "", track_id: 1, members: "", project_name: "", description: "", deck_url: "", table_number: "", built_with_lovable: false, voter_group: "" };

function TeamsTab({ code, teams, tracks, call }: {
  code: string; teams: Team[]; tracks: ReturnType<typeof useHubData>["tracks"];
  call: (fn: () => PromiseLike<{ error: unknown }>, msg?: string) => Promise<void>;
}) {
  const { lang } = useT();
  const [edit, setEdit] = useState<typeof emptyTeam | null>(null);
  return (
    <div className="space-y-3">
      <Button onClick={() => setEdit(emptyTeam)}>Add team</Button>
      <div className="grid gap-3 md:grid-cols-2">
        {teams.map((tm) => (
          <Card key={tm.id} className="p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="font-semibold">{tm.name} · {tm.project_name}</div>
                <div className="text-sm text-muted-foreground">{tm.description}</div>
                <div className="mt-2 flex flex-wrap gap-1 text-xs">
                  <Badge variant="secondary">{trackName(tracks.find((x) => x.id === tm.track_id), lang)}</Badge>
                  <Badge variant="outline">Table {tm.table_number}</Badge>
                  <Badge variant="outline">Group {tm.voter_group}</Badge>
                  {tm.built_with_lovable && <Badge>Lovable</Badge>}
                  {tm.is_demo && <Badge variant="destructive">demo</Badge>}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">{tm.members}</div>
              </div>
              <div className="flex flex-col gap-1">
                <Button size="sm" variant="outline" onClick={() => setEdit({ ...emptyTeam, ...tm, track_id: tm.track_id ?? 1 })}>Edit</Button>
                <Button size="sm" variant="ghost" onClick={() => confirm(`Delete ${tm.name}?`) && call(() => supabase.rpc("admin_delete_team", { p_code: code, p_id: tm.id }), "Deleted")}>Delete</Button>
              </div>
            </div>
          </Card>
        ))}
      </div>
      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{edit?.id ? "Edit team" : "New team"}</DialogTitle></DialogHeader>
          {edit && (
            <form className="space-y-3" onSubmit={async (e) => {
              e.preventDefault();
              await call(() => supabase.rpc("admin_upsert_team", { p_code: code, p_team: edit as never }), "Saved");
              setEdit(null);
            }}>
              {([["name", "Team name"], ["project_name", "Project name"], ["description", "One-line description"], ["members", "Members (comma separated)"], ["deck_url", "Deck link"], ["table_number", "Table number"], ["voter_group", "Voter-code group"]] as const).map(([k, l]) => (
                <label key={k} className="block text-sm">{l}
                  <Input required={k === "name"} value={edit[k]} onChange={(e) => setEdit({ ...edit, [k]: e.target.value })} className="mt-1" />
                </label>
              ))}
              <label className="block text-sm">Track
                <select className="mt-1 h-9 w-full rounded-md border bg-background px-2" value={edit.track_id}
                  onChange={(e) => setEdit({ ...edit, track_id: Number(e.target.value) })}>
                  {tracks.map((tr) => <option key={tr.id} value={tr.id}>{tr.name_en}</option>)}
                </select>
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={edit.built_with_lovable} onCheckedChange={(v) => setEdit({ ...edit, built_with_lovable: v })} />
                Built with Lovable (required for Lovable prizes)
              </label>
              <Button type="submit" className="w-full">Save</Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function VotersTab({ code, teams }: { code: string; teams: Team[] }) {
  const qc = useQueryClient();
  const [team, setTeam] = useState("");
  const [count, setCount] = useState(3);
  const list = useQuery({
    queryKey: ["hub", "voters", code],
    queryFn: async () => ((await supabase.rpc("admin_list_voters", { p_code: code })).data ?? []) as unknown as { code: string; team_id: string | null; used: number }[],
  });
  const gen = async () => {
    const { error } = await supabase.rpc("admin_generate_voters", { p_code: code, p_team: (team || null) as never, p_count: count });
    if (error) toast.error(errMsg(error));
    else toast.success(`${count} codes created`);
    qc.invalidateQueries({ queryKey: ["hub", "voters"] });
  };
  return (
    <div className="space-y-3">
      <Card className="flex flex-wrap items-end gap-2 p-4">
        <label className="text-sm">Team (blocks voting for own team)
          <select className="mt-1 block h-9 rounded-md border bg-background px-2" value={team} onChange={(e) => setTeam(e.target.value)}>
            <option value="">No team (guest)</option>
            {teams.map((tm) => <option key={tm.id} value={tm.id}>{tm.name} ({tm.voter_group})</option>)}
          </select>
        </label>
        <label className="text-sm">How many
          <Input type="number" min={1} max={200} className="mt-1 w-24" value={count} onChange={(e) => setCount(Number(e.target.value))} />
        </label>
        <Button onClick={gen}>Generate codes</Button>
      </Card>
      <Card className="overflow-x-auto p-4">
        <table className="w-full text-sm">
          <thead><tr className="border-b text-left"><th className="py-2">Code</th><th>Team</th><th>Votes used</th></tr></thead>
          <tbody>
            {list.data?.map((v) => (
              <tr key={v.code} className="border-b"><td className="py-1.5 font-mono">{v.code}</td><td>{teams.find((x) => x.id === v.team_id)?.name ?? "Guest"}</td><td>{v.used} / 3</td></tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function exportCsv(board: ReturnType<typeof computeLeaderboard>, tracks: ReturnType<typeof useHubData>["tracks"], results: ReturnType<typeof useHubData>["results"], judges: ReturnType<typeof useHubData>["judges"], teams: Team[], weights: Weights) {
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = [["rank", "team", "project", "track", "built_with_lovable", "judge_score", "judges_scored", "votes", "audience_score", "total", "avg_impact"].join(",")];
  board.forEach((r) => lines.push([r.rank, r.team.name, r.team.project_name, tracks.find((x) => x.id === r.team.track_id)?.name_en, r.team.built_with_lovable, r.judgeScore.toFixed(2), r.judgeCount, r.votes, r.audienceScore.toFixed(2), r.combined.toFixed(2), r.avgImpact.toFixed(2)].map(esc).join(",")));
  lines.push("", ["judge", "team", ...CRITERIA.map((c) => c.key), "weighted", "locked"].join(","));
  results?.scores.forEach((s) => lines.push([judges.find((j) => j.id === s.judge_id)?.name, teams.find((x) => x.id === s.team_id)?.name, ...CRITERIA.map((c) => s[c.key]), weightedScore(s, weights).toFixed(2), s.locked].map(esc).join(",")));
  const blob = new Blob([lines.join("\n")], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "hfh-taiwan-results.csv";
  a.click();
}
