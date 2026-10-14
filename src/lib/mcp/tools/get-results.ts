import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { supabaseAnon } from "../supabase";
import { computeLeaderboard, type Results, type Team, type Weights, type EventState } from "@/lib/hub";

export default defineTool({
  name: "get_results",
  title: "Get published results",
  description: "Get the final ranking (70% judges, 30% audience) once organizers have published results; otherwise reports they are not public yet.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async () => {
    const sb = supabaseAnon();
    const [r, t, s] = await Promise.all([sb.rpc("get_results", {}), sb.rpc("public_teams"), sb.rpc("public_event_state")]);
    if (r.error || t.error || s.error) throw new ToolError("Could not load results.");
    const results = r.data as unknown as Results;
    if (!results?.can_see) {
      return { content: [{ type: "text", text: "Results have not been published yet." }], structuredContent: { published: false, ranking: [] } };
    }
    const state = s.data as unknown as EventState;
    const ranking = computeLeaderboard((t.data ?? []) as unknown as Team[], results, state.weights as Weights).map((x) => ({
      rank: x.rank, team: x.team.name, project: x.team.project_name, track_id: x.team.track_id,
      combined: Math.round(x.combined * 10) / 10, judge_score: Math.round(x.judgeScore * 10) / 10,
      audience_score: Math.round(x.audienceScore * 10) / 10, votes: x.votes,
    }));
    return { content: [{ type: "text", text: JSON.stringify(ranking) }], structuredContent: { published: true, ranking } };
  },
});
