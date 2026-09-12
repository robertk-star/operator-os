import { AppNav } from "@/components/AppNav";
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
    <main className="wrap">
      <AppNav current="/app/contacts" />
      <p className="kicker">{workspace?.name}</p>
      <h1>Contacts</h1>
      <ContactList
        workspaceId={workspace?.id || ""}
        initialContacts={contacts || []}
        organizations={organizations || []}
      />
    </main>
  );
}
