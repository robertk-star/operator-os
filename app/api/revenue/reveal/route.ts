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
    lastName = lastName || data.last_name || "";
    domain = domain || domainOf(data.website);
    organizationName = organizationName || data.business_name || "";
  }

  const payload: Record<string, unknown> = {
    reveal_personal_emails: false,
    reveal_phone_number: false,
    run_waterfall_email: false,
    run_waterfall_phone: false,
  };
  if (personId) payload.id = personId;
  if (firstName) payload.first_name = firstName;
  if (lastName && !/\*/.test(lastName)) payload.last_name = lastName;
  if (domain) payload.domain = domain;
  if (organizationName) payload.organization_name = organizationName;

  const response = await fetch(
    "https://api.apollo.io/api/v1/people/match?reveal_personal_emails=false&reveal_phone_number=false&run_waterfall_email=false&run_waterfall_phone=false",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        accept: "application/json",
        "Cache-Control": "no-cache",
        "X-Api-Key": key,
      },
      body: JSON.stringify(payload),
    }
  );
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    return NextResponse.json({ error: result.error || result.message || JSON.stringify(result) }, { status: 400 });
  }

  const person = result.person || result;
  const email = person.email && !String(person.email).includes("*") ? person.email : "";

  if (contact) {
    const update: Record<string, unknown> = {
      email: email || null,
      email_status: email ? "review_required" : "missing",
      apollo_person_id: person.id || personId || null,
    };
    if (person.first_name) update.first_name = person.first_name;
    if (person.last_name && !/\*/.test(person.last_name)) {
      update.last_name = person.last_name;
      update.full_name = [person.first_name || firstName, person.last_name].filter(Boolean).join(" ");
    }
    if (person.title) update.job_title = person.title;
    if (person.linkedin_url) update.linkedin_url = person.linkedin_url;
    await supabase.from("contacts").update(update).eq("id", contact.id);
  }

  return NextResponse.json({
    email,
    person: {
      id: person.id || personId,
      first_name: person.first_name || firstName,
      last_name: person.last_name && !/\*/.test(person.last_name) ? person.last_name : lastName,
      title: person.title || "",
      email,
      linkedin_url: person.linkedin_url || "",
    },
    note: email
      ? "Email found. Apollo typically charges 1 credit for this person."
      : "No work email in Apollo. A match can still use 1 credit for unlocking the name.",
  });
}
