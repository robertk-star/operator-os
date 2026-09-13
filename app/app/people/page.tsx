import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentWorkspace } from "@/lib/workspace";

export default async function PeoplePage() {
  const workspace = await getCurrentWorkspace();
  const supabase = await createSupabaseServerClient();
  const { data: people } = workspace
    ? await supabase
        .from("contacts")
        .select("id, full_name, first_name, last_name, email, job_title, business_name, website")
        .eq("workspace_id", workspace.id)
        .eq("record_type", "person")
        .order("full_name")
    : { data: [] };

  return (
    <section className="main">
      <p className="kicker">Contacts</p>
      <h2>Contacts</h2>
      <p className="meta">People saved from reviewed company leads. Drip selection comes next.</p>
      <ul className="record-list">
        {(people || []).map((person) => (
          <li key={person.id}>
            <div>
              <strong>{person.full_name || [person.first_name, person.last_name].filter(Boolean).join(" ")}</strong>
              <div className="meta">{[person.job_title, person.business_name, person.email].filter(Boolean).join(" · ")}</div>
            </div>
          </li>
        ))}
      </ul>
      {!people?.length ? <p className="meta">No people contacts yet. Review a company lead, then find people.</p> : null}
    </section>
  );
}
