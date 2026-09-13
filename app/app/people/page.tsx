import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentWorkspace } from "@/lib/workspace";
import { PeopleDesk } from "./PeopleDesk";

const SELECT =
  "id, full_name, first_name, last_name, email, phone, business_name, job_title, industry, tags, source, email_status, street_address, city, state, postal_code, country, website, linkedin_url, status, do_not_disturb, reviewed, organization_id, organizations(name, domain)";

export default async function PeoplePage() {
  const workspace = await getCurrentWorkspace();
  const supabase = await createSupabaseServerClient();
  const { data: people } = workspace
    ? await supabase.from("contacts").select(SELECT).eq("workspace_id", workspace.id).eq("record_type", "person").order("full_name")
    : { data: [] };

  return (
    <section className="main contacts-main">
      <PeopleDesk workspaceId={workspace?.id || ""} initialContacts={people || []} />
    </section>
  );
}
