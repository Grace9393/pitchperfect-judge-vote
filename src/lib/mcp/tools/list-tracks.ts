import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { supabaseAnon } from "../supabase";

type Row = { id: number; name_en: string; name_zh: string; data_sources: string; sources: { label: string; url: string; verified_on: string }[] | null };

export default defineTool({
  name: "list_tracks",
  title: "List tracks",
  description: "List the hackathon tracks with their Taiwan open-data source references.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async () => {
    const { data, error } = await supabaseAnon().rpc("public_tracks");
    if (error) throw new ToolError("Could not load tracks.");
    const tracks = ((data ?? []) as unknown as Row[]).map((t) => ({
      id: t.id, name_en: t.name_en, name_zh: t.name_zh, data_sources: t.data_sources ?? "",
      sources: (t.sources ?? []).map((s) => ({ label: s.label ?? "", url: s.url ?? "", verified_on: s.verified_on ?? "" })),
    }));
    return { content: [{ type: "text", text: JSON.stringify(tracks) }], structuredContent: { tracks } };
  },
});
