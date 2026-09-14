import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentWorkspace } from "@/lib/workspace";
import { SequenceKpis } from "./SequenceKpis";
import { SequenceStudio } from "./SequenceStudio";

export default async function OutboundPage() {
  const workspace = await getCurrentWorkspace();
  const supabase = await createSupabaseServerClient();
  const [{ data: sequences }, { data: steps }, { data: people }, { data: enrollments }] = workspace
    ? await Promise.all([
        supabase.from("outbound_sequences").select("*").eq("workspace_id", workspace.id).order("created_at", { ascending: false }),
        supabase.from("outbound_sequence_steps").select("id, sequence_id, step_order, delay_days, subject, body_text").eq("workspace_id", workspace.id).order("step_order"),
        supabase.from("contacts").select("id, full_name, first_name, last_name, email, job_title, business_name, tags, record_type").eq("workspace_id", workspace.id).eq("record_type", "person").order("full_name"),
        supabase.from("sequence_enrollments").select("id, sequence_id, contact_id, status, contacts(full_name, email)").eq("workspace_id", workspace.id),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }, { data: [] }];

  return (
    <section className="main">
      <p className="kicker">Cold outreach</p>
      <h2>Outbound sequences</h2>
      <p className="meta">Connect Smartlead in Admin, sync mailboxes, pick a mailbox here, then Activate to send.</p>
      <SequenceKpis sequences={sequences || []} people={people || []} enrollments={enrollments || []} />
      <SequenceStudio
        workspaceId={workspace?.id || ""}
        initialSequences={sequences || []}
        initialSteps={steps || []}
        people={people || []}
        enrollments={enrollments || []}
      />
    </section>
  );
}
