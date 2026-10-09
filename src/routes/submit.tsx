import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useT } from "@/lib/i18n";
import { errMsg, trackName, useHubData } from "@/lib/hub";

export const Route = createFileRoute("/submit")({
  head: () => ({
    meta: [
      { title: "Submit Your Project — Hack for Humanity Taiwan" },
      { name: "description", content: "Attendees submit their name, email, project, track and Lovable link for Hack for Humanity Taiwan." },
      { property: "og:title", content: "Submit Your Project — Hack for Humanity Taiwan" },
      { property: "og:description", content: "Send in your Hack for Humanity Taiwan project and Lovable link." },
    ],
  }),
  component: SubmitPage,
});

const empty = { name: "", email: "", project: "", track: "", url: "" };

function SubmitPage() {
  const { t, lang } = useT();
  const { tracks } = useHubData();
  const [f, setF] = useState(empty);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr(null);
    if (!f.track) return setErr(t("pickTrack"));
    setBusy(true);
    const { error } = await supabase.rpc("submit_project", {
      p_name: f.name, p_email: f.email, p_project: f.project, p_track: Number(f.track), p_url: f.url,
    });
    setBusy(false);
    if (error) setErr(errMsg(error));
    else setDone(true);
  };

  if (done)
    return (
      <Card className="mx-auto mt-10 max-w-md p-8 text-center">
        <CheckCircle2 className="mx-auto h-12 w-12 text-primary" />
        <h1 className="mt-4 text-2xl font-semibold">{t("submitThanks")}</h1>
        <Button className="mt-6" variant="outline" onClick={() => { setF(empty); setDone(false); }}>{t("submitAnother")}</Button>
      </Card>
    );

  const field = (k: keyof typeof empty, label: string, type = "text", extra: Record<string, unknown> = {}) => (
    <label className="block text-sm font-medium">{label}
      <Input required type={type} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} className="mt-1 h-11" {...extra} />
    </label>
  );

  return (
    <Card className="mx-auto mt-8 max-w-md p-6">
      <h1 className="text-xl font-semibold">{t("submitTitle")}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{t("submitSub")}</p>
      <form onSubmit={submit} className="mt-5 space-y-4">
        {field("name", t("yourName"), "text", { maxLength: 100 })}
        {field("email", t("email"), "email", { maxLength: 255 })}
        {field("project", t("projectName"), "text", { maxLength: 120 })}
        <label className="block text-sm font-medium">{t("track")}
          <select required value={f.track} onChange={(e) => setF({ ...f, track: e.target.value })}
            className="mt-1 h-11 w-full rounded-md border bg-background px-3 text-sm">
            <option value="">—</option>
            {tracks.map((tr) => <option key={tr.id} value={tr.id}>{trackName(tr, lang)}</option>)}
          </select>
        </label>
        {field("url", t("lovableUrl"), "url", { maxLength: 500, placeholder: "https://your-project.lovable.app" })}
        {err && <p className="text-sm text-destructive">{err}</p>}
        <Button type="submit" className="h-11 w-full" disabled={busy}>{t("submitBtn")}</Button>
      </form>
    </Card>
  );
}
