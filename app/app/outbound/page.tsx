import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentWorkspace } from "@/lib/workspace";
import { SequenceList } from "./SequenceList";

export default async function OutboundPage() {
  const workspace = await getCurrentWorkspace();
  const supabase = await createSupabaseServerClient();
  const { data } = workspace
    ? await supabase.from("outbound_sequences").select("id, name, audience, status").eq("workspace_id", workspace.id).order("created_at", { ascending: false })
    : { data: [] };
  return (
    <section className="main">
      <p className="kicker">Outbound sequences</p>
      <h2>Outbound sequences</h2>
      <p className="meta">Sequences start empty. They use the Revenue Engine target settings, not a fixed industry list.</p>
      <SequenceList workspaceId={workspace?.id || ""} initialItems={data || []} />
    </section>
  );
}
