import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentWorkspace } from "@/lib/workspace";
import { RelationshipList } from "./RelationshipList";

export default async function RelationshipsPage({
  searchParams,
}: {
  searchParams: Promise<{ contact?: string }>;
}) {
  const { contact: selectedContactId } = await searchParams;
  const workspace = await getCurrentWorkspace();
  const supabase = await createSupabaseServerClient();
  const [{ data: events }, { data: contacts }] = workspace
    ? await Promise.all([
        supabase
          .from("relationship_events")
          .select("id, kind, summary, happened_at, contact_id, contacts(full_name)")
          .eq("workspace_id", workspace.id)
          .order("happened_at", { ascending: false }),
        supabase.from("contacts").select("id, full_name").eq("workspace_id", workspace.id).order("full_name"),
      ])
    : [{ data: [] }, { data: [] }];

  return (
    <section className="main">
      <p className="kicker">Relationships</p>
      <h2>Relationships</h2>
      <p className="meta">This workspace starts empty. Interactions appear after you log them.</p>
      <RelationshipList
        workspaceId={workspace?.id || ""}
        initialEvents={events || []}
        contacts={contacts || []}
        selectedContactId={selectedContactId || ""}
      />
    </section>
  );
}
