import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentWorkspace } from "@/lib/workspace";

const DEFAULT_TITLES = ["CEO", "President", "CFO", "Director of HR", "HR Director", "Benefits Coordinator", "Benefits Manager"];

function domainOf(value?: string | null) {
  if (!value) return "";
  try {
    return new URL(value.startsWith("http") ? value : `https://${value}`).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return value.replace(/^www\./, "").toLowerCase();
  }
}

function clean(value: unknown) {
  const text = String(value || "").trim();
  if (!text || /\*/.test(text)) return "";
  return text;
}

function namesOf(person: any) {
  const first = clean(person.first_name);
  const last = clean(person.last_name);
  const full = clean(person.name || person.full_name);
  const parts = full.split(/\s+/).filter(Boolean);
  return {
    first_name: first || parts[0] || "",
    last_name: last || (parts.length > 1 && !/\*/.test(parts.slice(1).join(" ")) ? parts.slice(1).join(" ") : ""),
    full_name: [first || parts[0], last].filter(Boolean).join(" ") || first || parts[0] || "Unknown",
  };
}

export async function GET(request: Request) {
  const workspace = await getCurrentWorkspace();
  if (!workspace) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const supabase = await createSupabaseServerClient();
  const url = new URL(request.url);
  const contactId = url.searchParams.get("contactId") || "";
  const { data: company } = await supabase
    .from("contacts")
    .select("id, reviewed, website, business_name, full_name, organization_id, organizations(domain, apollo_organization_id, name)")
    .eq("workspace_id", workspace.id)
    .eq("id", contactId)
    .maybeSingle();
  if (!company) return NextResponse.json({ error: "Company lead not found." }, { status: 404 });
  if (!company.reviewed) return NextResponse.json({ error: "Review this company before finding people." }, { status: 400 });

  const { data: settingsRow } = await supabase.from("integrations").select("metadata").eq("workspace_id", workspace.id).eq("provider", "workspace").maybeSingle();
  const titles = String((settingsRow?.metadata as { personTitles?: string } | null)?.personTitles || "")
    .split(/[;,\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
  const personTitles = titles.length ? titles : DEFAULT_TITLES;

  const org = Array.isArray(company.organizations) ? company.organizations[0] : company.organizations;
  const domain = domainOf(company.website || org?.domain || "");
  const key = process.env.APOLLO_API_KEY;
  if (!key) return NextResponse.json({ error: "APOLLO_API_KEY missing." }, { status: 400 });

  const body: Record<string, unknown> = { page: 1, per_page: 25, person_titles: personTitles };
  if (org?.apollo_organization_id) body.organization_ids = [org.apollo_organization_id];
  if (domain) body.q_organization_domains_list = [domain];

  const response = await fetch("https://api.apollo.io/api/v1/mixed_people/api_search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      accept: "application/json",
      "Cache-Control": "no-cache",
      "X-Api-Key": key,
    },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    return NextResponse.json({ error: payload.error || payload.message || JSON.stringify(payload), items: [] }, { status: 400 });
  }

  const people = payload.people || payload.contacts || [];
  const items = people.map((person: any) => {
    const names = namesOf(person);
    return {
      id: person.id || "",
      first_name: names.first_name,
      last_name: names.last_name,
      full_name: names.full_name,
      title: person.title || person.headline || "",
      email: person.email && person.email_status !== "unavailable" ? person.email : "",
      email_status: person.email_status || "",
      linkedin_url: person.linkedin_url || "",
    };
  });

  return NextResponse.json({
    company: company.business_name || company.full_name,
    domain,
    titles: personTitles,
    items,
    fetched: items.length,
  });
}
