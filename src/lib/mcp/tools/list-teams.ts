import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { supabaseAnon } from "../supabase";

type Row = { id: string; name: string; track_id: number | null; members: string; project_name: string; description: string; deck_url: string; table_number: string; built_with_lovable: boolean };

export default defineTool({
  name: "list_teams",
  title: "List teams",
  description: "List the competing teams with track, project name, one-line description, deck link and table number.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async () => {
    const { data, error } = await supabaseAnon().rpc("public_teams");
    if (error) throw new ToolError("Could not load teams.");
    const teams = ((data ?? []) as unknown as Row[]).map((t) => ({
      id: t.id, name: t.name, track_id: t.track_id, members: t.members ?? "", project_name: t.project_name ?? "",
      description: t.description ?? "", deck_url: t.deck_url ?? "", table_number: t.table_number ?? "", built_with_lovable: !!t.built_with_lovable,
    }));
    return { content: [{ type: "text", text: JSON.stringify(teams) }], structuredContent: { teams } };
  },
});
