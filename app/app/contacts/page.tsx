import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentWorkspace } from "@/lib/workspace";
import { ContactList } from "./ContactList";

export default async function ContactsPage() {
  const workspace = await getCurrentWorkspace();
  const supabase = await createSupabaseServerClient();
  const [{ data: contacts }, { data: organizations }] = workspace
    ? await Promise.all([
        supabase
          .from("contacts")
          .select("id, full_name, email, phone, organization_id, organizations(name)")
          .eq("workspace_id", workspace.id)
          .order("full_name"),
        supabase.from("organizations").select("id, name").eq("workspace_id", workspace.id).order("name"),
      ])
    : [{ data: [] }, { data: [] }];

  return (
    <section className="main">
      <p className="kicker">Contacts</p>
      <h2>Contacts</h2>
      <p className="meta">This workspace starts empty. Add people as you work.</p>
      <ContactList workspaceId={workspace?.id || ""} initialContacts={contacts || []} organizations={organizations || []} />
    </section>
  );
}
