import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { supabaseAnon } from "../supabase";

type EventRow = { name: string; name_zh: string; starts_at: string; ends_at: string; timezone: string; venue: string; city: string; organizer: string; partner: string; is_active: boolean };

export default defineTool({
  name: "get_event",
  title: "Get event status",
  description: "Get the active hackathon's name, time, venue and current phase (check-in, hacking, pitches, voting, results).",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async () => {
    const sb = supabaseAnon();
    const [ev, st] = await Promise.all([sb.rpc("public_events"), sb.rpc("public_event_state")]);
    if (ev.error || st.error) throw new ToolError("Could not load event information.");
    const events = (ev.data ?? []) as unknown as EventRow[];
    const e = events.find((x) => x.is_active) ?? events[0];
    const s = (st.data ?? {}) as { phase?: string; voting_open?: boolean; scoring_open?: boolean; scores_revealed?: boolean };
    const event = e ? {
      name: e.name, name_zh: e.name_zh, starts_at: e.starts_at, ends_at: e.ends_at, timezone: e.timezone,
      venue: e.venue, city: e.city, organizer: e.organizer, partner: e.partner,
    } : null;
    const status = { phase: s.phase ?? "unknown", voting_open: !!s.voting_open, scoring_open: !!s.scoring_open, results_published: !!s.scores_revealed || s.phase === "results" };
    return { content: [{ type: "text", text: JSON.stringify({ event, status }) }], structuredContent: { event, status } };
  },
});
