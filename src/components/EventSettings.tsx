import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, CalendarDays, MapPin, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useT } from "@/lib/i18n";
import { errMsg } from "@/lib/hub";
import { eventDateLine, localEventTime, utcEventTime, useEvents, type EventRecord } from "@/lib/events";
import { supabase } from "@/integrations/supabase/client";

const blank = { name: "", name_zh: "", starts_at: "", ends_at: "", timezone: "Asia/Taipei", venue: "", city: "", organizer: "", partner: "" };

export function EventSettings({ code }: { code: string }) {
  const { lang } = useT();
  const zh = lang === "zh";
  const { data: events = [] } = useEvents();
  const qc = useQueryClient();
  const [selected, setSelected] = useState<string | null>(null);
  const [draft, setDraft] = useState(blank);
  const [busy, setBusy] = useState(false);
  const [activate, setActivate] = useState<EventRecord | null>(null);
  const [started, setStarted] = useState(false);
  const edit = (event: EventRecord) => {
    setSelected(event.id);
    setDraft({ ...blank, ...event, starts_at: localEventTime(event.starts_at, event.timezone), ends_at: localEventTime(event.ends_at, event.timezone) });
    setStarted(true);
  };
  useEffect(() => {
    const active = events.find((e) => e.is_active);
    if (active && !started) edit(active);
  }, [events, started]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true);
    try {
      const patch = { ...draft, starts_at: utcEventTime(draft.starts_at, draft.timezone), ends_at: utcEventTime(draft.ends_at, draft.timezone) };
      const { data, error } = selected
        ? await supabase.rpc("admin_save_event", { p_code: code, p_id: selected, p_patch: patch })
        : await supabase.rpc("admin_create_event", { p_code: code, p_patch: patch });
      if (error) throw error;
      setSelected(data); await qc.invalidateQueries({ queryKey: ["hub"] });
      toast.success(selected ? (zh ? "活動已儲存" : "Event saved") : (zh ? "活動已建立，準備好後可設為使用中" : "Event created — make it active when ready"));
    } catch (error) { toast.error(errMsg(error)); }
    finally { setBusy(false); }
  };

  const fields = [
    ["name", zh ? "活動名稱（英文）" : "Event name"], ["name_zh", zh ? "活動名稱（繁中，可選）" : "Traditional Chinese name (optional)"],
    ["starts_at", zh ? "開始時間" : "Start date & time"], ["ends_at", zh ? "結束時間" : "End date & time"],
    ["timezone", zh ? "時區" : "Timezone"], ["venue", zh ? "場地名稱" : "Venue name"], ["city", zh ? "地點／城市" : "Location / city"],
    ["organizer", zh ? "主辦單位" : "Organizer"], ["partner", zh ? "官方合作夥伴" : "Official partner"],
  ] as const;

  return <section className="space-y-5 border-b pb-6">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-lg font-semibold">{zh ? "活動" : "Events"}</h2>
      <Button variant="outline" onClick={() => { setSelected(null); setDraft({ ...blank }); setStarted(true); }}><Plus />{zh ? "新增活動" : "New event"}</Button>
    </div>
    <div className="grid gap-3 sm:grid-cols-2">{events.map((event) => <div key={event.id} className={`min-w-0 rounded-md border p-4 ${selected === event.id ? "border-primary" : ""}`}>
      <div className="flex flex-wrap items-center gap-2"><h3 className="break-words font-semibold">{zh ? event.name_zh || event.name : event.name}</h3>{event.is_active && <Badge><Check className="mr-1 h-3 w-3" />{zh ? "使用中" : "Active"}</Badge>}</div>
      <p className="mt-2 flex gap-2 text-xs text-muted-foreground"><CalendarDays className="h-4 w-4 shrink-0" /><span>{eventDateLine(event, lang)}</span></p>
      <div className="mt-3 flex gap-2"><Button variant="outline" size="sm" onClick={() => edit(event)}>{zh ? "編輯" : "Edit"}</Button>{!event.is_active && <Button size="sm" onClick={() => setActivate(event)}>{zh ? "設為使用中" : "Make active"}</Button>}</div>
    </div>)}</div>
    <form onSubmit={save} className="space-y-4">
      <h3 className="font-medium">{selected ? (zh ? "編輯活動" : "Edit event") : (zh ? "新增活動" : "New event")}</h3>
      <div className="grid gap-4 sm:grid-cols-2">{fields.map(([key, label]) => <label key={key} className="block text-sm font-medium">{label}
        <Input className="mt-1" required={["name", "starts_at", "ends_at", "timezone", "venue"].includes(key)}
          type={key === "starts_at" || key === "ends_at" ? "datetime-local" : "text"} value={draft[key]}
          maxLength={key === "name" ? 120 : 200} list={key === "timezone" ? "event-timezones" : undefined}
          onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))} />
      </label>)}</div>
      <datalist id="event-timezones">{["Asia/Taipei", "Asia/Tokyo", "Asia/Singapore", "Europe/Berlin", "Europe/London", "America/New_York", "America/Los_Angeles", "UTC"].map((zone) => <option key={zone} value={zone} />)}</datalist>
      <p className="text-xs text-muted-foreground">{zh ? "請依所選時區輸入時間。新活動會複製賽道、評審碼與權重，不會複製隊伍、作品、分數或投票。管理碼全站共用。" : "Enter times in the selected timezone. New events copy tracks, judge codes and weights, not teams, submissions, scores or votes. The admin code is shared across events."}</p>
      <Button type="submit" disabled={busy}><MapPin />{busy ? (zh ? "儲存中…" : "Saving…") : selected ? (zh ? "儲存活動" : "Save event") : (zh ? "建立活動" : "Create event")}</Button>
    </form>
    <AlertDialog open={!!activate} onOpenChange={(open) => !open && setActivate(null)}><AlertDialogContent>
      <AlertDialogHeader><AlertDialogTitle>{zh ? "切換使用中的活動？" : "Switch the active event?"}</AlertDialogTitle>
        <AlertDialogDescription>{zh ? `網站將顯示「${activate?.name}」。舊活動資料會保留。兩場活動的評分與投票會關閉；請重新確認後開放。` : `The website will show ${activate?.name}. Previous event data is retained. Scoring and voting for both events will close; reopen them only when ready.`}</AlertDialogDescription></AlertDialogHeader>
      <AlertDialogFooter><AlertDialogCancel>{zh ? "取消" : "Cancel"}</AlertDialogCancel><AlertDialogAction onClick={async () => {
        if (!activate) return;
        const { error } = await supabase.rpc("admin_activate_event", { p_code: code, p_id: activate.id });
        if (error) toast.error(errMsg(error)); else { await qc.invalidateQueries({ queryKey: ["hub"] }); edit(activate); toast.success(zh ? "已切換活動" : "Active event changed"); }
        setActivate(null);
      }}>{zh ? "確認切換" : "Confirm switch"}</AlertDialogAction></AlertDialogFooter>
    </AlertDialogContent></AlertDialog>
  </section>;
}