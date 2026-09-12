import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentWorkspace } from "@/lib/workspace";
import { SequenceBoard } from "./SequenceBoard";

export default async function OutboundPage() {
  const workspace = await getCurrentWorkspace();
  const supabase = await createSupabaseServerClient();
  const [{ data: sequences }, { data: contacts }, { data: enrollments }, { data: settings }] = workspace
    ? await Promise.all([
        supabase.from("outbound_sequences").select("id, name, audience, status").eq("workspace_id", workspace.id).order("created_at", { ascending: false }),
        supabase.from("contacts").select("id, full_name, email").eq("workspace_id", workspace.id).order("full_name"),
        supabase.from("sequence_enrollments").select("id, sequence_id, contact_id, status, contacts(full_name, email)").eq("workspace_id", workspace.id),
        supabase.from("integrations").select("metadata").eq("workspace_id", workspace.id).eq("provider", "workspace").maybeSingle(),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }, { data: null }];
  const targets = ((settings?.metadata as { revenueTargets?: string } | null)?.revenueTargets || "").trim();

  return (
    <section className="main">
      <p className="kicker">Outbound sequences</p>
      <h2>Outbound sequences</h2>
      <p className="meta">Sequences start empty. Enroll contacts. This does not send Gmail yet.</p>
      {targets ? <p className="meta">Revenue targets: {targets}</p> : <p className="meta">Set Revenue Engine targets in Settings so sequences have an audience definition.</p>}
      <SequenceBoard
        workspaceId={workspace?.id || ""}
        initialSequences={sequences || []}
        contacts={contacts || []}
        enrollments={enrollments || []}
      />
    </section>
  );
}
