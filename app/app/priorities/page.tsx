import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentWorkspace } from "@/lib/workspace";
import { PriorityList } from "./PriorityList";

export default async function PrioritiesPage() {
  const workspace = await getCurrentWorkspace();
  const supabase = await createSupabaseServerClient();
  const { data } = workspace
    ? await supabase.from("priorities").select("id, title, rank, status").eq("workspace_id", workspace.id).order("rank")
    : { data: [] };
  return (
    <section className="main">
      <p className="kicker">Priorities</p>
      <h2>Priorities</h2>
      <p className="meta">The short list that should stay visible this week.</p>
      <PriorityList workspaceId={workspace?.id || ""} initialItems={data || []} />
    </section>
  );
}
