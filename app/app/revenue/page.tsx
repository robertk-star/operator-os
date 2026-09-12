import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentWorkspace } from "@/lib/workspace";
import { RevenueBoard } from "./RevenueBoard";

export default async function RevenuePage({
  searchParams,
}: {
  searchParams: Promise<{ contact?: string }>;
}) {
  const { contact } = await searchParams;
  const workspace = await getCurrentWorkspace();
  const supabase = await createSupabaseServerClient();
  const [{ data: opportunities }, { data: contacts }, { data: settings }] = workspace
    ? await Promise.all([
        supabase
          .from("opportunities")
          .select("id, title, stage, amount_cents, contact_id, contacts(full_name)")
          .eq("workspace_id", workspace.id)
          .order("created_at", { ascending: false }),
        supabase.from("contacts").select("id, full_name").eq("workspace_id", workspace.id).order("full_name"),
        supabase.from("integrations").select("metadata").eq("workspace_id", workspace.id).eq("provider", "workspace").maybeSingle(),
      ])
    : [{ data: [] }, { data: [] }, { data: null }];
  const targets = ((settings?.metadata as { revenueTargets?: string } | null)?.revenueTargets || "").trim();

  return (
    <section className="main">
      <p className="kicker">Revenue Engine</p>
      <h2>Revenue Engine</h2>
      <p className="meta">Universal pipeline. Targets come from Settings, not from a fixed industry list.</p>
      {targets ? <p className="meta">Current targets: {targets}</p> : <p className="meta">Set target company types in Settings first.</p>}
      <RevenueBoard
        workspaceId={workspace?.id || ""}
        initialOpportunities={opportunities || []}
        contacts={contacts || []}
        selectedContactId={contact || ""}
      />
    </section>
  );
}
