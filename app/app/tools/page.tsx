import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentWorkspace } from "@/lib/workspace";
import { ToolList } from "./ToolList";

export default async function ToolsPage() {
  const workspace = await getCurrentWorkspace();
  const supabase = await createSupabaseServerClient();
  const { data } = workspace
    ? await supabase.from("tools").select("id, name, url, notes").eq("workspace_id", workspace.id).order("name")
    : { data: [] };
  return (
    <section className="main">
      <p className="kicker">Tools</p>
      <h2>Tools</h2>
      <p className="meta">The link library for this workspace. Empty until you add tools.</p>
      <ToolList workspaceId={workspace?.id || ""} initialItems={data || []} />
    </section>
  );
}
