import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentWorkspace } from "@/lib/workspace";
import { ContactsDesk } from "./ContactsDesk";

const SELECT =
  "id, full_name, first_name, last_name, email, phone, business_name, job_title, industry, tags, source, email_status, street_address, city, state, postal_code, country, website, linkedin_url, status, do_not_disturb, research_notes, researched_at, reviewed, organization_id, organizations(name, domain)";

export default async function ContactsPage() {
  const workspace = await getCurrentWorkspace();
  const supabase = await createSupabaseServerClient();
  const { data: contacts } = workspace
    ? await supabase.from("contacts").select(SELECT).eq("workspace_id", workspace.id).order("full_name")
    : { data: [] };

  return (
    <section className="main contacts-main">
      <ContactsDesk workspaceId={workspace?.id || ""} initialContacts={contacts || []} />
    </section>
  );
}
