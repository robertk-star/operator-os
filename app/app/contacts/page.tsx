import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentWorkspace } from "@/lib/workspace";
import { ContactList } from "./ContactList";

export default async function ContactsPage() {
  const workspace = await getCurrentWorkspace();
  const supabase = await createSupabaseServerClient();
  const [{ data: contacts }, { data: organizations }, { data: sequences }] = workspace
    ? await Promise.all([
        supabase
          .from("contacts")
          .select("id, full_name, email, phone, organization_id, organizations(name)")
          .eq("workspace_id", workspace.id)
          .order("full_name"),
        supabase.from("organizations").select("id, name").eq("workspace_id", workspace.id).order("name"),
        supabase.from("outbound_sequences").select("id, name").eq("workspace_id", workspace.id).order("name"),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }];

  return (
    <section className="main">
      <p className="kicker">Contacts</p>
      <h2>Contacts</h2>
      <p className="meta">Starts empty. People you add can go into Revenue and Outbound.</p>
      <ContactList
        workspaceId={workspace?.id || ""}
        initialContacts={contacts || []}
        organizations={organizations || []}
        sequences={sequences || []}
      />
    </section>
  );
}
