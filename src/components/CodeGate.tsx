import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";

export function CodeGate({ title, label, cta, onSubmit, hint }: {
  title: string; label: string; cta: string; hint?: string; onSubmit: (code: string) => Promise<string | null>;
}) {
  const [code, setCode] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(await onSubmit(code.trim()));
    setBusy(false);
  };
  return (
    <Card className="mx-auto mt-10 max-w-sm p-6">
      <h1 className="text-xl font-semibold">{title}</h1>
      <form onSubmit={submit} className="mt-4 space-y-3">
        <label className="block text-sm text-muted-foreground">{label}</label>
        <Input value={code} onChange={(e) => setCode(e.target.value)} autoCapitalize="characters" autoComplete="off"
          className="h-12 text-center font-mono text-lg tracking-widest" />
        {err && <p className="text-sm text-destructive">{err}</p>}
        <Button type="submit" className="h-11 w-full" disabled={busy || !code.trim()}>{cta}</Button>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </form>
    </Card>
  );
}
