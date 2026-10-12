import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { summarizeSubmission } from "@/lib/ai-review.functions";
import { scanSubmission } from "@/lib/repo-scan.functions";
import { supabase } from "@/integrations/supabase/client";
import { CodeGate } from "@/components/CodeGate";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { EventSettings } from "@/components/EventSettings";
import { RoleGuide, guideSteps } from "@/components/RoleGuide";
import { eventName, useActiveEvent } from "@/lib/events";
import { ResultsView } from "@/components/ResultsView";
import { useT } from "@/lib/i18n";
import {
  CRITERIA, PHASES, computeLeaderboard, errMsg, normalizeWeights, trackName, useHubData, useStoredCode, weightedScore,
  type Team, type Track, type TrackSource, type Weights,
} from "@/lib/hub";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
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
  const event = useActiveEvent();
  const qc = useQueryClient();
  const { state, teams, tracks, judges, results } = hub;
  const [confirmPublish, setConfirmPublish] = useState<null | "reveal" | "phase">(null);

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
        <h1 className="text-xl font-semibold">{eventName(event, lang)} · {lang === "zh" ? "管理" : "Admin"}</h1>
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
          <TabsTrigger value="subs">Submissions</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
          <TabsTrigger value="guide">{lang === "zh" ? "主辦指南" : "Admin guide"}</TabsTrigger>
        </TabsList>

        <TabsContent value="control" className="space-y-4">
          <Card className="p-4">
            <div className="mb-2 text-sm font-medium">Event phase</div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-6">
              {PHASES.map((p) => (
                <Button key={p.key} variant={state.phase === p.key ? "default" : "outline"} className="h-auto py-2"
                  onClick={() => p.key === "results" && !state.scores_revealed ? setConfirmPublish("phase") : patch({ phase: p.key, ...(p.key === "voting" ? { voting_open: true } : {}), ...(p.key === "pitches" ? { scoring_open: true } : {}) })}>
                  {lang === "zh" ? p.zh : p.en}
                </Button>
              ))}
            </div>
          </Card>
          <div className="grid gap-4 md:grid-cols-3">
            <ToggleCard label="Judge scoring open" checked={state.scoring_open} onChange={(v) => patch({ scoring_open: v })} />
            <ToggleCard label="Audience voting open" checked={state.voting_open} onChange={(v) => patch({ voting_open: v })} />
            <ToggleCard label="Reveal scores (judges + results screen)" checked={state.scores_revealed} onChange={(v) => (v ? setConfirmPublish("reveal") : patch({ scores_revealed: false }, "Results hidden"))} />
          </div>
          <Card className="space-y-3 p-4">
            <div className="text-sm font-medium">Current team on stage</div>
            <div className="text-lg font-semibold">{current ? `${current.name} · ${current.project_name}` : "None — judges see “waiting for next team”"}</div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" disabled={currentIdx <= 0} onClick={() => patch({ current_team_id: teams[currentIdx - 1]!.id, timer_started_at: "" })}>← Previous</Button>
              <Button disabled={currentIdx >= teams.length - 1} onClick={() => patch({ current_team_id: teams[currentIdx + 1]!.id, timer_started_at: "" })}>Next team →</Button>
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
          <Card className="space-y-4 border-dashed p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="font-medium">Results screen preview (only you can see this)</div>
                <p className="text-sm text-muted-foreground">
                  {state.scores_revealed || state.phase === "results" ? "Results are currently PUBLISHED on the Results page." : "Not published yet. The Results page shows a holding screen."}
                </p>
              </div>
              {state.scores_revealed || state.phase === "results" ? <Badge>Published</Badge> : (
                <Button onClick={() => setConfirmPublish("reveal")}>Publish to Results page…</Button>
              )}
            </div>
            <div className="rounded-lg bg-muted/40 p-4"><ResultsView board={board} tracks={tracks} /></div>
          </Card>
        </TabsContent>

        <TabsContent value="subs"><SubmissionsTab code={code} tracks={tracks} /></TabsContent>

        <TabsContent value="voters"><VotersTab code={code} teams={teams} /></TabsContent>

        <TabsContent value="guide" className="max-w-3xl space-y-5 py-5">
          <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold">{lang === "zh" ? "主辦指南" : "Organizer quick guide"}</h2><Button variant="outline" onClick={async () => {
            try { await navigator.clipboard.writeText(`${eventName(event, lang)} — ${lang === "zh" ? "主辦指南" : "Organizer quick guide"}\n\n${guideSteps.admin[lang].map(([title, detail], i) => `${i + 1}. ${title}\n${detail}`).join("\n\n")}`); toast.success(lang === "zh" ? "已複製" : "Guide copied"); } catch { toast.error(lang === "zh" ? "無法複製，請選取文字" : "Could not copy; select the guide text instead"); }
          }}>{lang === "zh" ? "複製指南" : "Copy guide"}</Button></div>
          <RoleGuide role="admin" />
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <EventSettings code={code} />
          <CodesCard code={code} onAdminChanged={onSignOut} />
          <TracksEditor code={code} tracks={tracks} />
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

      <AlertDialog open={!!confirmPublish} onOpenChange={(o) => !o && setConfirmPublish(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Publish results?</AlertDialogTitle>
            <AlertDialogDescription>
              This shows the winners and all standings on the public Results page (and the projector) right away, and lets judges see each other's scores.
              {board[0] && ` Current 1st place: ${board[0].team.name} (${board[0].combined.toFixed(1)}).`} Check the preview first.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              patch(confirmPublish === "phase" ? { phase: "results", scores_revealed: true, voting_open: false, scoring_open: false } : { scores_revealed: true }, "Results published");
              setConfirmPublish(null);
            }}>Yes, publish results</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function CodesCard({ code, onAdminChanged }: { code: string; onAdminChanged: () => void }) {
  const qc = useQueryClient();
  const status = useQuery({
    queryKey: ["hub", "codes", code],
    queryFn: async () => (await supabase.rpc("admin_code_status", { p_code: code })).data as unknown as { admin_default: boolean; judges: { id: string; name: string; is_default: boolean }[] },
  });
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const gen = () => {
    const a = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const b = new Uint32Array(10);
    crypto.getRandomValues(b);
    return Array.from(b, (x) => a[x % a.length]).join("").replace(/(.{5})/, "$1-");
  };
  const [saved, setSaved] = useState<Record<string, string>>({});
  const [show, setShow] = useState<Record<string, boolean>>({});
  const copy = async (v: string) => {
    try { await navigator.clipboard.writeText(v); toast.success("Copied"); } catch { /* ignore */ }
  };
  const save = async (key: string) => {
    const v = drafts[key]?.trim();
    if (!v) return;
    if (key === "admin" && !confirm(`Set the new admin code to "${v}"? You'll need it to sign in again.`)) return;
    const { error } = key === "admin"
      ? await supabase.rpc("admin_set_admin_code", { p_code: code, p_new: v })
      : await supabase.rpc("admin_set_judge_code", { p_code: code, p_judge: key, p_new: v });
    if (error) { toast.error(errMsg(error)); return; }
    toast.success("Code updated");
    setDrafts((d) => ({ ...d, [key]: "" }));
    if (key === "admin") onAdminChanged();
    else { setSaved((s) => ({ ...s, [key]: v })); qc.invalidateQueries({ queryKey: ["hub", "codes"] }); }
  };
  const row = (key: string, label: string, isDefault: boolean | undefined, min: number) => {
    const v = drafts[key] ?? "";
    const len = v.trim().length;
    return (
      <div key={key} className="space-y-2 rounded-md border p-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{label}</span>
          {isDefault ? <Badge variant="destructive">placeholder</Badge> : <Badge variant="secondary">custom</Badge>}
        </div>
        <form className="flex flex-wrap items-center gap-2" onSubmit={(e) => { e.preventDefault(); if (len >= min) save(key); }}>
          <Input className="min-w-0 flex-1 font-mono" type={show[key] === false ? "password" : "text"} autoComplete="off"
            placeholder={`Type a new code (min ${min} characters)`} value={v}
            onChange={(e) => setDrafts((d) => ({ ...d, [key]: e.target.value.toUpperCase() }))} />
          <Button type="button" size="sm" variant="outline" onClick={() => { const g = gen(); setDrafts((d) => ({ ...d, [key]: g })); copy(g); }}>Generate</Button>
          {v && <Button type="button" size="sm" variant="ghost" onClick={() => copy(v)}>Copy</Button>}
          <Button type="submit" size="sm" disabled={len < min}>Save</Button>
        </form>
        {v && len < min && <p className="text-xs text-muted-foreground">{min - len} more character(s) needed</p>}
        {saved[key] && (
          <p className="text-xs text-muted-foreground">
            New code saved: <span className="font-mono text-foreground">{saved[key]}</span>{" "}
            <button className="text-primary underline" onClick={() => copy(saved[key]!)}>copy</button> — share it privately; it won't be shown after you leave this page.
          </p>
        )}
      </div>
    );
  };
  return (
    <Card className="space-y-3 p-4">
      <div className="font-medium">Access codes</div>
      <p className="text-sm text-muted-foreground">
        Codes are stored only as one-way hashes, so nobody (including organizers) can read them back. Copy a new code before saving and share it privately.
        Changing the admin code signs you out.
      </p>
      {row("admin", "Admin", status.data?.admin_default, 10)}
      {status.data?.judges?.map((j) => row(j.id, j.name, j.is_default, 8))}
    </Card>
  );
}

function TracksEditor({ code, tracks }: { code: string; tracks: Track[] }) {
  const qc = useQueryClient();
  const [edit, setEdit] = useState<Record<number, { data_sources: string; sources: TrackSource[] }>>({});
  useEffect(() => {
    setEdit(Object.fromEntries(tracks.map((t) => [t.id, { data_sources: t.data_sources, sources: t.sources ?? [] }])));
  }, [tracks]);
  const today = () => new Date().toISOString().slice(0, 10);
  const save = async (id: number) => {
    const e = edit[id];
    if (!e) return;
    const bad = e.sources.find((s) => s.url && !/^https?:\/\//.test(s.url));
    if (bad) { toast.error(`URL must start with http(s)://: ${bad.url}`); return; }
    const { error } = await supabase.rpc("admin_update_track", { p_code: code, p_id: id, p_data_sources: e.data_sources, p_sources: e.sources.filter((s) => s.url || s.label) as never });
    if (error) toast.error(errMsg(error));
    else toast.success("Track sources saved");
    qc.invalidateQueries({ queryKey: ["hub"] });
  };
  const upd = (id: number, i: number, k: keyof TrackSource, v: string) =>
    setEdit((m) => ({ ...m, [id]: { ...m[id]!, sources: m[id]!.sources.map((s, j) => (j === i ? { ...s, [k]: v } : s)) } }));
  return (
    <Card className="space-y-4 p-4">
      <div className="font-medium">Track data sources</div>
      {tracks.map((tr) => {
        const e = edit[tr.id];
        if (!e) return null;
        return (
          <div key={tr.id} className="space-y-2 rounded-md border p-3">
            <div className="text-sm font-semibold">{tr.name_en}</div>
            <Textarea value={e.data_sources} rows={2} onChange={(ev) => setEdit((m) => ({ ...m, [tr.id]: { ...e, data_sources: ev.target.value } }))} />
            {e.sources.map((s, i) => (
              <div key={i} className="grid gap-2 sm:grid-cols-[1fr_1.4fr_9rem_auto_auto]">
                <Input placeholder="Label" value={s.label} onChange={(ev) => upd(tr.id, i, "label", ev.target.value)} />
                <Input placeholder="https://…" value={s.url} onChange={(ev) => upd(tr.id, i, "url", ev.target.value)} />
                <Input type="date" value={s.verified_on} onChange={(ev) => upd(tr.id, i, "verified_on", ev.target.value)} />
                <Button size="sm" variant="outline" onClick={() => upd(tr.id, i, "verified_on", today())}>Verified today</Button>
                <Button size="sm" variant="ghost" onClick={() => setEdit((m) => ({ ...m, [tr.id]: { ...e, sources: e.sources.filter((_, j) => j !== i) } }))}>Remove</Button>
              </div>
            ))}
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setEdit((m) => ({ ...m, [tr.id]: { ...e, sources: [...e.sources, { label: "", url: "", verified_on: "" }] } }))}>Add source</Button>
              <Button size="sm" onClick={() => save(tr.id)}>Save track</Button>
            </div>
          </div>
        );
      })}
    </Card>
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

type Submission = {
  id: string; name: string; email: string; project_name: string; track_id: number; lovable_url: string; created_at: string;
  description: string; review_status: string; notes: string; ai_summary: string; ai_summary_at: string | null;
  github_repo: string; lovable_project_id: string; scan_verdict: string; scan_confidence: string;
  lovable_commit_share: number | null; phase_breakdown: Record<string, number | null>; scan_signals: string[];
  scan_note: string; scanned_at: string | null;
};
const REVIEW_STATUSES = [
  { v: "new", label: "New" }, { v: "reviewing", label: "Reviewing" }, { v: "follow_up", label: "Needs follow-up" },
  { v: "approved", label: "Approved" }, { v: "rejected", label: "Rejected" },
];
const statusLabel = (v: string) => REVIEW_STATUSES.find((s) => s.v === v)?.label ?? v;
type SortKey = "created_at" | "track" | "project";

function SubmissionsTab({ code, tracks }: { code: string; tracks: Track[] }) {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [trackFilter, setTrackFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "created_at", dir: -1 });
  const [open, setOpen] = useState<Submission | null>(null);
  const list = useQuery({
    queryKey: ["hub", "subs", code],
    queryFn: async () => ((await supabase.rpc("admin_list_submissions", { p_code: code })).data ?? []) as unknown as Submission[],
    refetchInterval: 15000,
  });
  const trackNameOf = (id: number) => tracks.find((t) => t.id === id)?.name_en ?? "";
  const filtered = (list.data ?? []).filter((s) => {
    if (trackFilter && String(s.track_id) !== trackFilter) return false;
    if (statusFilter && s.review_status !== statusFilter) return false;
    const needle = q.trim().toLowerCase();
    if (!needle) return true;
    return [s.name, s.email, s.project_name, s.lovable_url, trackNameOf(s.track_id), s.notes].some((v) => (v ?? "").toLowerCase().includes(needle));
  }).sort((a, b) => {
    const val = (s: Submission) => sort.key === "created_at" ? s.created_at : sort.key === "track" ? trackNameOf(s.track_id) : s.project_name.toLowerCase();
    const r = val(a) < val(b) ? -1 : val(a) > val(b) ? 1 : 0;
    return r * sort.dir || (a.created_at < b.created_at ? 1 : -1);
  });
  const toggleSort = (key: SortKey) => setSort((s) => s.key === key ? { key, dir: (s.dir * -1) as 1 | -1 } : { key, dir: key === "created_at" ? -1 : 1 });
  const SortTh = ({ k, children }: { k: SortKey; children: string }) => (
    <th className="py-2">
      <button type="button" className="inline-flex items-center gap-1 font-medium hover:text-primary" onClick={() => toggleSort(k)}>
        {children}<span className="text-xs text-muted-foreground">{sort.key === k ? (sort.dir === 1 ? "▲" : "▼") : "↕"}</span>
      </button>
    </th>
  );
  const csv = () => {
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const rows = [["submitted_at", "name", "email", "project", "track", "project_url", "review_status", "notes", "scan_verdict", "scan_confidence", "lovable_commit_pct", "github_repo", "lovable_project_id", "scan_note"].join(",")];
    filtered.forEach((s) => rows.push([new Date(s.created_at).toISOString(), s.name, s.email, s.project_name, trackNameOf(s.track_id), s.lovable_url, statusLabel(s.review_status), s.notes, s.scan_verdict, s.scan_confidence, s.lovable_commit_share ?? "", s.github_repo, s.lovable_project_id, s.scan_note].map(esc).join(",")));
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([rows.join("\n")], { type: "text/csv" }));
    a.download = "hfh-submissions.csv";
    a.click();
  };
  const followUps = (list.data ?? []).filter((s) => s.review_status === "follow_up").length;
  return (
    <Card className="space-y-3 overflow-x-auto p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="font-medium">{filtered.length} of {list.data?.length ?? 0} submissions · {followUps} need follow-up · public form at /submit</div>
        <Button size="sm" variant="outline" onClick={csv}>Export CSV</Button>
      </div>
      <div className="flex flex-wrap gap-2">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, email, project, notes…" className="h-9 w-64" />
        <select value={trackFilter} onChange={(e) => setTrackFilter(e.target.value)} className="h-9 rounded-md border bg-background px-2 text-sm">
          <option value="">All tracks</option>
          {tracks.map((t) => <option key={t.id} value={t.id}>{t.name_en}</option>)}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="h-9 rounded-md border bg-background px-2 text-sm">
          <option value="">All statuses</option>
          {REVIEW_STATUSES.map((s) => <option key={s.v} value={s.v}>{s.label}</option>)}
        </select>
      </div>
      <table className="w-full text-sm">
        <thead><tr className="border-b text-left">
          <th className="py-2">Name</th><SortTh k="project">Project</SortTh><SortTh k="track">Track</SortTh>
          <th>Status</th><th>URL</th><SortTh k="created_at">Submitted</SortTh><th />
        </tr></thead>
        <tbody>
          {filtered.map((s) => (
            <tr key={s.id} className="border-b align-top">
              <td className="py-1.5">{s.name}<div className="text-xs text-muted-foreground">{s.email}</div></td>
              <td>{s.project_name}
                {s.scan_verdict && s.scan_verdict !== "error" && s.scan_verdict !== "unresolved" && (
                  <Badge variant={s.scan_verdict === "No evidence" ? "outline" : "default"} className="ml-1 text-[10px]">
                    {s.scan_verdict === "No evidence" ? "no Lovable evidence" : `Lovable ✓${s.lovable_commit_share != null ? ` ${s.lovable_commit_share}%` : ""}`}
                  </Badge>)}
                {s.notes && <div className="line-clamp-1 text-xs text-muted-foreground">📝 {s.notes}</div>}</td>
              <td className="text-xs">{trackNameOf(s.track_id)}</td>
              <td><Badge variant={s.review_status === "follow_up" ? "destructive" : s.review_status === "approved" ? "default" : "secondary"}>{statusLabel(s.review_status)}</Badge></td>
              <td><a href={s.lovable_url} target="_blank" rel="noreferrer" className="text-primary underline">link</a></td>
              <td className="text-xs text-muted-foreground">{new Date(s.created_at).toLocaleString()}</td>
              <td className="whitespace-nowrap">
                <Button size="sm" variant="outline" onClick={() => setOpen(s)}>Review</Button>
                <Button size="sm" variant="ghost" onClick={async () => {
                  if (!confirm(`Delete submission from ${s.name}?`)) return;
                  const { error } = await supabase.rpc("admin_delete_submission", { p_code: code, p_id: s.id });
                  if (error) toast.error(errMsg(error));
                  qc.invalidateQueries({ queryKey: ["hub", "subs"] });
                }}>Delete</Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {open && <ReviewDialog key={open.id} code={code} sub={open} tracks={tracks} onClose={() => { setOpen(null); qc.invalidateQueries({ queryKey: ["hub", "subs"] }); }} />}
    </Card>
  );
}

type ScanResult = {
  repo?: string | undefined; repoUrl?: string | undefined; lovableProjectId?: string | undefined;
  verdict?: string | undefined; confidence?: string | undefined;
  commits?: number | undefined; lovableCommits?: number | undefined; commitShare?: number | null | undefined;
  phaseMix?: Record<string, number | null> | undefined; signals?: string[] | undefined; note?: string | undefined;
};

function ReviewDialog({ code, sub, tracks, onClose }: { code: string; sub: Submission; tracks: Track[]; onClose: () => void }) {
  const summarize = useServerFn(summarizeSubmission);
  const scan = useServerFn(scanSubmission);
  const [f, setF] = useState({
    project: sub.project_name, description: sub.description ?? "", track: String(sub.track_id), url: sub.lovable_url,
    status: sub.review_status, notes: sub.notes ?? "", summary: sub.ai_summary ?? "",
  });
  const [busy, setBusy] = useState<"ai" | "save" | "scan" | null>(null);
  const [aiErr, setAiErr] = useState<string | null>(null);
  const [scanErr, setScanErr] = useState<string | null>(null);
  const [scanRes, setScanRes] = useState<ScanResult | null>(
    sub.scan_verdict ? {
      repo: sub.github_repo, repoUrl: sub.github_repo ? `https://github.com/${sub.github_repo}` : undefined,
      lovableProjectId: sub.lovable_project_id, verdict: sub.scan_verdict, confidence: sub.scan_confidence,
      commitShare: sub.lovable_commit_share, phaseMix: sub.phase_breakdown, signals: sub.scan_signals, note: sub.scan_note,
    } : null);
  const runScan = async () => {
    setBusy("scan"); setScanErr(null);
    try {
      const r = await scan({ data: { code, submissionId: sub.id, target: f.url } });
      if (r.error) setScanErr(r.error); else setScanRes(r.result as ScanResult);
    } catch (e) { setScanErr((e as Error).message); }
    setBusy(null);
  };
  const runAi = async () => {
    setBusy("ai"); setAiErr(null);
    try {
      const r = await summarize({ data: {
        code, projectName: f.project, description: f.description, url: f.url,
        track: tracks.find((t) => String(t.id) === f.track)?.name_en ?? "",
      } });
      if (r.error) setAiErr(r.error); else setF((p) => ({ ...p, summary: r.text }));
    } catch (e) { setAiErr((e as Error).message); }
    setBusy(null);
  };
  const save = async () => {
    setBusy("save");
    const patch: Record<string, string> = { review_status: f.status, notes: f.notes, description: f.description };
    if (f.summary !== sub.ai_summary) patch["ai_summary"] = f.summary;
    const { error } = await supabase.rpc("admin_update_submission", { p_code: code, p_id: sub.id, p_patch: patch });
    setBusy(null);
    if (error) return void toast.error(errMsg(error));
    toast.success("Review saved");
    onClose();
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader><DialogTitle>Review: {sub.project_name}</DialogTitle></DialogHeader>
        <div className="space-y-3 text-sm">
          <div className="text-xs text-muted-foreground">{sub.name} · {sub.email} · submitted {new Date(sub.created_at).toLocaleString()}</div>
          <label className="block font-medium">Project name
            <Input value={f.project} maxLength={120} onChange={(e) => setF({ ...f, project: e.target.value })} className="mt-1" />
          </label>
          <label className="block font-medium">Description
            <Textarea value={f.description} maxLength={2000} rows={3} placeholder="What does the project do? Paste from the deck or pitch."
              onChange={(e) => setF({ ...f, description: e.target.value })} className="mt-1" />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block font-medium">Track
              <select value={f.track} onChange={(e) => setF({ ...f, track: e.target.value })} className="mt-1 h-10 w-full rounded-md border bg-background px-2">
                {tracks.map((t) => <option key={t.id} value={t.id}>{t.name_en}</option>)}
              </select>
            </label>
            <label className="block font-medium">Project URL
              <Input value={f.url} maxLength={500} onChange={(e) => setF({ ...f, url: e.target.value })} className="mt-1" />
            </label>
          </div>
          <div className="rounded-md border p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="font-medium">AI summary & review considerations</div>
              <Button size="sm" variant="secondary" onClick={runAi} disabled={busy !== null || !f.project.trim()}>
                {busy === "ai" ? "Thinking…" : f.summary ? "Regenerate" : "Generate with AI"}
              </Button>
            </div>
            {aiErr && <p className="mt-2 text-destructive">{aiErr}</p>}
            {f.summary
              ? <div className="mt-2 whitespace-pre-wrap text-sm">{f.summary.replace(/\*\*/g, "")}</div>
              : <p className="mt-2 text-xs text-muted-foreground">Uses the details above. AI can't open the link — always check the project yourself.</p>}
          </div>
          <div className="rounded-md border p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="font-medium">Lovable usage scan</div>
              <Button size="sm" variant="secondary" onClick={runScan} disabled={busy !== null || !f.url.trim()}>
                {busy === "scan" ? "Scanning…" : scanRes ? "Re-scan repository" : "Scan repository"}
              </Button>
            </div>
            {scanErr && <p className="mt-2 text-destructive">{scanErr}</p>}
            {scanRes ? (
              <div className="mt-2 space-y-1.5 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={scanRes.verdict === "No evidence" || scanRes.verdict === "error" || scanRes.verdict === "unresolved" ? "outline" : "default"}>
                    {scanRes.verdict}
                  </Badge>
                  {scanRes.confidence && <span className="text-xs text-muted-foreground">confidence: {scanRes.confidence}</span>}
                  {scanRes.commitShare != null && <span className="text-xs text-muted-foreground">{scanRes.commitShare}% of {scanRes.commits} commits by Lovable</span>}
                </div>
                {scanRes.phaseMix && scanRes.lovableCommits != null && scanRes.lovableCommits > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(scanRes.phaseMix).map(([p, v]) => v != null && (
                      <span key={p} className="rounded-full bg-muted px-2 py-0.5 text-xs">{p} {v}%</span>
                    ))}
                  </div>)}
                {scanRes.signals && scanRes.signals.length > 0 && (
                  <ul className="list-inside list-disc text-xs text-muted-foreground">
                    {scanRes.signals.map((s) => <li key={s}>{s}</li>)}
                  </ul>)}
                <div className="flex flex-wrap gap-3 text-xs">
                  {scanRes.repoUrl && <a href={scanRes.repoUrl} target="_blank" rel="noreferrer" className="text-primary underline">{scanRes.repo}</a>}
                  {scanRes.lovableProjectId && <span className="text-muted-foreground">project {scanRes.lovableProjectId.slice(0, 8)}…</span>}
                </div>
                {scanRes.note && <p className="text-xs text-muted-foreground">{scanRes.note}</p>}
                {sub.scanned_at && <p className="text-xs text-muted-foreground">Scanned {new Date(sub.scanned_at).toLocaleString()}</p>}
              </div>
            ) : (
              <p className="mt-2 text-xs text-muted-foreground">
                Checks the project's GitHub repo (resolving Lovable project links automatically) for Lovable fingerprints and bot commits. Takes a few seconds.
              </p>
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-[180px_1fr]">
            <label className="block font-medium">Review status
              <select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })} className="mt-1 h-10 w-full rounded-md border bg-background px-2">
                {REVIEW_STATUSES.map((s) => <option key={s.v} value={s.v}>{s.label}</option>)}
              </select>
            </label>
            <label className="block font-medium">Private notes (organizers only)
              <Textarea value={f.notes} maxLength={5000} rows={3} onChange={(e) => setF({ ...f, notes: e.target.value })} className="mt-1" />
            </label>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={save} disabled={busy !== null}>{busy === "save" ? "Saving…" : "Save review"}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
