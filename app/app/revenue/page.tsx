import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentWorkspace } from "@/lib/workspace";
import { RevenueBoard } from "./RevenueBoard";

export default async function RevenuePage() {
  const workspace = await getCurrentWorkspace();
  const supabase = await createSupabaseServerClient();
  const [{ data: opportunities }, { data: contacts }] = workspace
    ? await Promise.all([
        supabase
          .from("opportunities")
          .select("id, title, stage, amount_cents, contact_id, contacts(full_name)")
          .eq("workspace_id", workspace.id)
          .order("created_at", { ascending: false }),
        supabase.from("contacts").select("id, full_name").eq("workspace_id", workspace.id).order("full_name"),
      ])
    : [{ data: [] }, { data: [] }];

  return (
    <section className="main">
      <p className="kicker">Revenue Engine</p>
      <h2>Revenue Engine</h2>
      <p className="meta">Universal pipeline. Target company types will live in Settings, not in this screen.</p>
      <RevenueBoard workspaceId={workspace?.id || ""} initialOpportunities={opportunities || []} contacts={contacts || []} />
    </section>
  );
}
