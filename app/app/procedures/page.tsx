import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentWorkspace } from "@/lib/workspace";
import { ProcedureList } from "./ProcedureList";

export default async function ProceduresPage() {
  const workspace = await getCurrentWorkspace();
  const supabase = await createSupabaseServerClient();
  const { data } = workspace
    ? await supabase.from("procedures").select("id, title, body, updated_at").eq("workspace_id", workspace.id).order("title")
    : { data: [] };
  return (
    <section className="main">
      <p className="kicker">Procedures</p>
      <h2>Procedures</h2>
      <p className="meta">How this workspace does repeatable work. Empty until you write them.</p>
      <ProcedureList workspaceId={workspace?.id || ""} initialItems={data || []} />
    </section>
  );
}
