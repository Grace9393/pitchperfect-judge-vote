import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveEvent } from "@/lib/events";
import { CodeGate } from "@/components/CodeGate";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useT } from "@/lib/i18n";
import { errMsg, trackName, useHubData, useStoredCode } from "@/lib/hub";

export const Route = createFileRoute("/vote")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Audience Vote — Event Judging Hub" },
      { name: "description", content: "Cast your three audience votes for your favourite Event Judging Hub projects." },
      { property: "og:title", content: "Audience Vote — Event Judging Hub" },
      { property: "og:description", content: "Three votes, one per team. Pick your favourites." },
    ],
  }),
  component: VotePage,
});

type Voter = { id: string; team_id: string | null; voted: string[] };

function VotePage() {
  const { t, lang } = useT();
  const event = useActiveEvent();
  const [code, setCode, ready] = useStoredCode("hfh-voter");
  const [voter, setVoter] = useState<Voter | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const { teams, tracks, state } = useHubData();

  const load = useCallback(async (c: string) => {
    const { data } = await supabase.rpc("voter_login", { p_code: c });
    if (data) setVoter(data as unknown as Voter);
    return !!data;
  }, []);

  useEffect(() => {
    if (code) load(code).then((ok) => !ok && setCode(null));
  }, [code, load, event?.id]);

  if (!ready) return null;
  if (!code || !voter)
    return (
      <CodeGate title={t("vote")} label={t("enterVoterCode")} cta={t("continue")}
        onSubmit={async (c) => {
          if (!(await load(c))) return t("invalidCode");
          setCode(c.toUpperCase());
          return null;
        }} />
    );

  const left = 3 - voter.voted.length;
  const cast = async (teamId: string) => {
    setBusy(teamId);
    const { error } = await supabase.rpc("cast_vote", { p_code: code, p_team: teamId });
    setBusy(null);
    if (error) toast.error(errMsg(error));
    else toast.success(t("voteRecorded"));
    await load(code);
  };

  const header = (
    <div className="flex items-center justify-between">
      <div className="font-mono text-sm text-muted-foreground">{code}</div>
      <Button variant="ghost" size="sm" onClick={() => { setCode(null); setVoter(null); }}>{t("signOut")}</Button>
    </div>
  );

  if (left <= 0)
    return (
      <div className="mx-auto max-w-xl space-y-4 px-4 py-6">
        {header}
        <Card className="p-10 text-center">
          <CheckCircle2 className="mx-auto h-12 w-12 text-primary" />
          <h1 className="mt-4 text-2xl font-semibold">{t("thanks")}</h1>
          <p className="mt-2 text-muted-foreground">{t("thanksSub")}</p>
          <ul className="mt-4 space-y-1 text-sm">
            {voter.voted.map((id) => <li key={id}>✓ {teams.find((x) => x.id === id)?.name}</li>)}
          </ul>
        </Card>
      </div>
    );

  return (
    <div className="mx-auto max-w-xl space-y-4 px-4 py-6">
      {header}
      <Card className="flex items-center justify-between p-4">
        <div className="text-lg font-semibold">{t("vote")}</div>
        <div className="flex gap-1.5" aria-label={`${left} ${t("votesLeft")}`}>
          {[0, 1, 2].map((i) => <span key={i} className={`h-4 w-4 rounded-full ${i < left ? "bg-primary" : "bg-muted"}`} />)}
          <span className="ml-2 text-sm text-muted-foreground">{left} {t("votesLeft")}</span>
        </div>
      </Card>
      {!state?.voting_open && <Card className="p-4 text-center text-sm text-muted-foreground">{t("votingClosed")}</Card>}
      <div className="space-y-3">
        {teams.filter((tm) => tm.id !== voter.team_id).map((tm) => {
          const done = voter.voted.includes(tm.id);
          return (
            <Card key={tm.id} className="flex items-center gap-3 p-4">
              <div className="min-w-0 flex-1">
                <div className="font-semibold">{tm.name} <span className="font-normal text-muted-foreground">· {tm.project_name}</span></div>
                <p className="text-sm text-muted-foreground">{tm.description}</p>
                <Badge variant="secondary" className="mt-2">{trackName(tracks.find((x) => x.id === tm.track_id), lang)}</Badge>
              </div>
              <Button className="h-11 min-w-20" variant={done ? "secondary" : "default"}
                disabled={done || !state?.voting_open || busy !== null} onClick={() => cast(tm.id)}>
                {done ? t("voted") : t("voteFor")}
              </Button>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
