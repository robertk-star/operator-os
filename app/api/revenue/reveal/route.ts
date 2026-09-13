import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentWorkspace } from "@/lib/workspace";

function domainOf(value?: string | null) {
  if (!value) return "";
  try {
    return new URL(value.startsWith("http") ? value : `https://${value}`).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return String(value).replace(/^www\./, "").toLowerCase();
  }
}

export async function POST(request: Request) {
  const workspace = await getCurrentWorkspace();
  if (!workspace) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const supabase = await createSupabaseServerClient();
  const body = await request.json().catch(() => ({}));
  const key = process.env.APOLLO_API_KEY;
  if (!key) return NextResponse.json({ error: "APOLLO_API_KEY missing." }, { status: 400 });

  const contactId = body.contactId as string | undefined;
  let personId = String(body.personId || "");
  let firstName = String(body.first_name || "");
  let lastName = String(body.last_name || "");
  let domain = domainOf(body.domain || body.website || "");
  let organizationName = String(body.company || "");
  let contact: { id: string } | null = null;

  if (contactId) {
    const { data } = await supabase
      .from("contacts")
      .select("id, first_name, last_name, full_name, website, business_name, apollo_person_id")
      .eq("workspace_id", workspace.id)
      .eq("id", contactId)
      .maybeSingle();
    if (!data) return NextResponse.json({ error: "Contact not found." }, { status: 404 });
    contact = data;
    personId = personId || data.apollo_person_id || "";
    firstName = firstName || data.first_name || "";
    lastName = lastName || data.last_name || data.full_name || "";
    domain = domain || domainOf(data.website);
    organizationName = organizationName || data.business_name || "";
  }

  const payload: Record<string, unknown> = {
    reveal_personal_emails: false,
    reveal_phone_number: false,
  };
  if (personId) payload.id = personId;
  if (firstName) payload.first_name = firstName;
  if (lastName) payload.last_name = lastName;
  if (domain) payload.domain = domain;
  if (organizationName) payload.organization_name = organizationName;

  const response = await fetch("https://api.apollo.io/api/v1/people/match", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      accept: "application/json",
      "Cache-Control": "no-cache",
      "X-Api-Key": key,
    },
    body: JSON.stringify(payload),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    return NextResponse.json({ error: result.error || result.message || JSON.stringify(result) }, { status: 400 });
  }

  const person = result.person || result;
  const email = person.email || person.work_email || "";
  const patch = {
    email: email || null,
    email_status: email ? "review_required" : "missing",
    first_name: person.first_name || firstName,
    last_name: person.last_name || lastName,
    job_title: person.title || undefined,
    linkedin_url: person.linkedin_url || undefined,
    apollo_person_id: person.id || personId || null,
  };

  if (contact) {
    const update: Record<string, unknown> = {
      email: patch.email,
      email_status: patch.email_status,
      apollo_person_id: patch.apollo_person_id,
    };
    if (patch.first_name) update.first_name = patch.first_name;
    if (patch.last_name) update.last_name = patch.last_name;
    if (person.title) update.job_title = person.title;
    if (person.linkedin_url) update.linkedin_url = person.linkedin_url;
    await supabase.from("contacts").update(update).eq("id", contact.id);
  }

  return NextResponse.json({
    email,
    email_status: person.email_status || (email ? "found" : "missing"),
    person: {
      id: person.id || personId,
      first_name: person.first_name || firstName,
      last_name: person.last_name || lastName,
      title: person.title || "",
      email,
      linkedin_url: person.linkedin_url || "",
    },
    note: email ? "Email found. About 1 Apollo credit if Apollo returned new email data." : "No email found. Apollo should not charge when nothing is returned.",
  });
}
