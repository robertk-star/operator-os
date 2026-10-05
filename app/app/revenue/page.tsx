import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentWorkspace } from "@/lib/workspace";
import { LeadFinder } from "./LeadFinder";
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
  const metadata = (settings?.metadata || {}) as { apolloProfiles?: { id: string; name: string }[] };
  const profiles = Array.isArray(metadata.apolloProfiles) ? metadata.apolloProfiles.map((item) => ({ id: item.id, name: item.name })) : [];

  return (
    <section className="main">
      <p className="kicker">Revenue Engine</p>
      <h2>Revenue Engine</h2>
      <p className="meta">Pick a saved Apollo search, then find companies and save them as leads.</p>
      <LeadFinder workspaceId={workspace?.id || ""} profiles={profiles} />
      <RevenueBoard
        workspaceId={workspace?.id || ""}
        initialOpportunities={opportunities || []}
        contacts={contacts || []}
        selectedContactId={contact || ""}
      />
    </section>
  );
}
