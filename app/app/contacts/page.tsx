import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentWorkspace } from "@/lib/workspace";
import { ContactsDeskHost } from "./ContactsDeskHost";

const SELECT =
  "id, full_name, first_name, last_name, email, phone, business_name, job_title, industry, tags, source, email_status, street_address, city, state, postal_code, country, website, linkedin_url, status, do_not_disturb, research_notes, researched_at, reviewed, record_type, organization_id, organizations(name, domain)";

export default async function ContactsPage() {
  const workspace = await getCurrentWorkspace();
  const supabase = await createSupabaseServerClient();
  const { data: contacts } = workspace
    ? await supabase.from("contacts").select(SELECT).eq("workspace_id", workspace.id).eq("record_type", "company").neq("status", "drip_complete").order("full_name")
    : { data: [] };

  return (
    <section className="main contacts-main">
      <ContactsDeskHost workspaceId={workspace?.id || ""} initialContacts={contacts || []} />
    </section>
  );
}
