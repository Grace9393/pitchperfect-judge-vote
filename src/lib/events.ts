import { useQuery } from "@tanstack/react-query";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { supabase } from "@/integrations/supabase/client";

export type EventRecord = {
  id: string; name: string; name_zh: string; starts_at: string; ends_at: string;
  timezone: string; venue: string; city: string; organizer: string; partner: string; is_active: boolean;
};

export function useEvents() {
  return useQuery({
    queryKey: ["hub", "events"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("public_events");
      if (error) throw error;
      return (data ?? []) as EventRecord[];
    },
    refetchInterval: 5000,
  });
}

export function useActiveEvent() {
  return useEvents().data?.find((event) => event.is_active);
}

export function eventName(event: EventRecord | undefined, lang: "en" | "zh") {
  return event ? (lang === "zh" ? event.name_zh || event.name : event.name) : "Event Hub";
}

export function eventDateLine(event: EventRecord | undefined, lang: "en" | "zh") {
  if (!event) return "";
  const locale = lang === "zh" ? "zh-TW" : "en-GB";
  const date = new Intl.DateTimeFormat(locale, { timeZone: event.timezone, year: "numeric", month: "short", day: "numeric", weekday: "short" });
  const time = new Intl.DateTimeFormat(locale, { timeZone: event.timezone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  const start = new Date(event.starts_at), end = new Date(event.ends_at);
  const sameDay = formatInTimeZone(start, event.timezone, "yyyy-MM-dd") === formatInTimeZone(end, event.timezone, "yyyy-MM-dd");
  return `${date.format(start)} · ${time.format(start)}–${sameDay ? "" : date.format(end) + " "}${time.format(end)} · ${event.timezone} · ${[event.venue, event.city].filter(Boolean).join(", ")}`;
}

export const localEventTime = (value: string, timezone: string) => formatInTimeZone(value, timezone, "yyyy-MM-dd'T'HH:mm");
export const utcEventTime = (value: string, timezone: string) => fromZonedTime(value, timezone).toISOString();