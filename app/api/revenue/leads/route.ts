import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentWorkspace } from "@/lib/workspace";

type Settings = {
  locations?: string;
  employeeRanges?: string;
  keywords?: string;
  industries?: string;
  excludeKeywords?: string;
  excludeIndustries?: string;
  apolloCompanyPage?: number;
};

const DEFAULT_1000_PLUS = ["1001,5000", "5001,10000", "10001+"];
const DEFAULT_STAFFING = ["staffing", "recruiting", "recruiter", "recruitment", "talent agency", "employment agency"];

function splitList(value: string | undefined) {
  return String(value || "")
    .split(/[;,\n]/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function normalizeEmployeeRanges(value: string | undefined) {
  const raw = String(value || "").trim();
  if (!raw) return DEFAULT_1000_PLUS;
  const tokens = raw.split(/[;\n]/).map((part) => part.trim().replace(/\s/g, "")).filter(Boolean);
  const ranges: string[] = [];
  for (const token of tokens) {
    if (token === "1000" || token === "1000+") {
      for (const item of DEFAULT_1000_PLUS) if (!ranges.includes(item)) ranges.push(item);
      continue;
    }
    if (/^\d+,\d+$/.test(token) || /^\d{2,}\+$/.test(token)) ranges.push(token);
  }
  return ranges.length ? [...new Set(ranges)] : DEFAULT_1000_PLUS;
}

function domainOf(value: string) {
  try {
    const url = value.startsWith("http") ? value : `https://${value}`;
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return value.replace(/^www\./, "").toLowerCase();
  }
}

function websiteOf(url: string) {
  const trimmed = url.trim();
  if (!trimmed) return null;
  return trimmed.startsWith("http") ? trimmed : `https://${trimmed}`;
}

function isStaffing(text: string, terms: string[]) {
  const haystack = text.toLowerCase();
  return terms.some((term) => term && haystack.includes(term.toLowerCase()));
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const requested = url.searchParams.get("q")?.trim();
  const requestedPage = Number(url.searchParams.get("page") || "0");
  const supabase = await createSupabaseServerClient();
  const workspace = await getCurrentWorkspace();
  if (!workspace) return NextResponse.json({ query: "", items: [] }, { status: 401 });

  const [{ data: settingsRow }, { data: savedOrgs }] = await Promise.all([
    supabase.from("integrations").select("metadata").eq("workspace_id", workspace.id).eq("provider", "workspace").maybeSingle(),
    supabase.from("organizations").select("name, domain, apollo_organization_id").eq("workspace_id", workspace.id),
  ]);
  const settings = (settingsRow?.metadata || {}) as Settings;
  const page = requestedPage > 0 ? Math.min(requestedPage, 500) : Number(settings.apolloCompanyPage || 1);
  const savedNames = new Set((savedOrgs || []).map((org) => (org.name || "").trim().toLowerCase()));
  const savedDomains = new Set((savedOrgs || []).map((org) => (org.domain || "").replace(/^www\./, "").toLowerCase()).filter(Boolean));
  const savedApollo = new Set((savedOrgs || []).map((org) => org.apollo_organization_id).filter(Boolean));

  const locations = splitList(settings.locations);
  const ranges = normalizeEmployeeRanges(settings.employeeRanges);
  const industries = splitList(settings.industries).filter((item) => !/staffing|recruit/i.test(item));
  const keywords = splitList(requested || settings.keywords).filter((item) => !/staffing|recruit/i.test(item));
  const staffingTerms = [...splitList(settings.excludeKeywords), ...splitList(settings.excludeIndustries)];
  const terms = staffingTerms.length ? staffingTerms : DEFAULT_STAFFING;
  const tags = [...industries, ...keywords];
  const filters = { locations, employeeRanges: ranges, industries, keywords, staffingTerms: terms, page };

  const key = process.env.APOLLO_API_KEY;
  if (!key) return NextResponse.json({ source: "none", items: [], error: "APOLLO_API_KEY missing.", filters });

  const body: Record<string, unknown> = { page, per_page: 100 };
  if (locations.length) body.organization_locations = locations;
  if (ranges.length) body.organization_num_employees_ranges = ranges;
  if (tags.length) body.q_organization_keyword_tags = tags;

  const response = await fetch("https://api.apollo.io/api/v1/mixed_companies/search", {
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
    return NextResponse.json({
      source: "apollo",
      items: [],
      error: payload.error || payload.message || JSON.stringify(payload),
      filters,
    });
  }

  const organizations = payload.organizations || payload.accounts || [];
  const mapped = organizations.map((org: any) => {
    const site = org.website_url || org.primary_domain || "";
    return {
      id: org.id || org.organization_id || "",
      name: org.name || "Unknown company",
      url: site,
      domain: domainOf(site || org.primary_domain || ""),
      snippet: [org.short_description, org.industry].filter(Boolean).join(" · "),
      industry: org.industry || "",
      source: "apollo",
    };
  });

  const fresh = mapped.filter((item: { id: string; name: string; domain: string }) => {
    if (item.id && savedApollo.has(item.id)) return false;
    if (savedNames.has(item.name.trim().toLowerCase())) return false;
    if (item.domain && savedDomains.has(item.domain)) return false;
    return true;
  });

  const staffing = fresh.filter((item: { name: string; snippet: string; industry: string }) =>
    isStaffing(`${item.name} ${item.snippet} ${item.industry}`, terms)
  );
  const items = fresh.filter((item: { name: string; snippet: string; industry: string }) =>
    !isStaffing(`${item.name} ${item.snippet} ${item.industry}`, terms)
  );

  let filed = 0;
  for (const lead of staffing) {
    const orgInsert: Record<string, unknown> = {
      workspace_id: workspace.id,
      name: lead.name,
      domain: lead.domain || null,
    };
    if (lead.id) orgInsert.apollo_organization_id = lead.id;
    let { data: organization, error: orgError } = await supabase.from("organizations").insert(orgInsert).select("id").single();
    if (orgError) {
      const retry = await supabase.from("organizations").insert({ workspace_id: workspace.id, name: lead.name, domain: lead.domain || null }).select("id").single();
      organization = retry.data;
      orgError = retry.error;
    }
    if (orgError || !organization) continue;
    const contactInsert: Record<string, unknown> = {
      workspace_id: workspace.id,
      organization_id: organization.id,
      full_name: lead.name,
      business_name: lead.name,
      website: websiteOf(lead.url),
      industry: lead.industry || "Staffing & Recruiting",
      source: "apollo",
      status: "staffing",
      email_status: "missing",
    };
    const { error: contactError } = await supabase.from("contacts").insert(contactInsert);
    if (contactError) {
      await supabase.from("contacts").insert({
        workspace_id: workspace.id,
        organization_id: organization.id,
        full_name: lead.name,
        status: "staffing",
      });
    }
    filed += 1;
  }

  await supabase.from("integrations").upsert(
    {
      workspace_id: workspace.id,
      provider: "workspace",
      status: "connected",
      metadata: { ...settings, apolloCompanyPage: page },
    },
    { onConflict: "workspace_id,provider" }
  );

  const skipped = organizations.length - fresh.length;
  return NextResponse.json({
    source: "apollo",
    items,
    error: "",
    filters,
    skipped,
    filed,
    fetched: organizations.length,
    page,
    nextPage: organizations.length ? page + 1 : page,
  });
}
