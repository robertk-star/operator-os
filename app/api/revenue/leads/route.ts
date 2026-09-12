import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentWorkspace } from "@/lib/workspace";

type Settings = {
  revenueTargets?: string;
  locations?: string;
  employeeRanges?: string;
  keywords?: string;
};

function splitList(value: string | undefined, extra: string[] = []) {
  const parts = String(value || "")
    .split(/[;\n]/)
    .map((part) => part.trim())
    .filter(Boolean);
  return parts.length ? parts : extra;
}

async function searchApollo(settings: Settings, overrideQuery: string) {
  const key = process.env.APOLLO_API_KEY;
  if (!key) return { items: [], error: "APOLLO_API_KEY is missing in Vercel." };

  const locations = splitList(settings.locations);
  const ranges = splitList(settings.employeeRanges);
  const keywords = splitList(overrideQuery || settings.keywords || settings.revenueTargets);

  if (!locations.length && !ranges.length && !keywords.length) {
    return { items: [], error: "Set locations, employee ranges, or keywords in Settings first." };
  }

  const body: Record<string, unknown> = {
    page: 1,
    per_page: 10,
  };
  if (locations.length) body.organization_locations = locations;
  if (ranges.length) body.organization_num_employees_ranges = ranges;
  if (keywords.length) body.q_organization_keyword_tags = keywords;

  const response = await fetch("https://api.apollo.io/api/v1/mixed_companies/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-cache",
      "X-Api-Key": key,
    },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    return { items: [], error: payload.error || payload.message || `Apollo returned ${response.status}.` };
  }
  const organizations = payload.organizations || payload.accounts || [];
  const items = organizations.map((org: any) => ({
    name: org.name || "Unknown company",
    url: org.website_url || org.primary_domain || "",
    snippet: [org.short_description, org.industry, org.estimated_num_employees ? `${org.estimated_num_employees} employees` : ""]
      .filter(Boolean)
      .join(" · "),
    employees: org.estimated_num_employees ? String(org.estimated_num_employees) : "",
    location: [org.city, org.state, org.country].filter(Boolean).join(", "),
    source: "apollo",
  }));
  return { items, error: items.length ? "" : "Apollo returned no companies for your Settings filters." };
}

export async function GET(request: Request) {
  const requested = new URL(request.url).searchParams.get("q")?.trim();
  const supabase = await createSupabaseServerClient();
  const workspace = await getCurrentWorkspace();
  if (!workspace) return NextResponse.json({ query: "", items: [] }, { status: 401 });

  const { data } = await supabase
    .from("integrations")
    .select("metadata")
    .eq("workspace_id", workspace.id)
    .eq("provider", "workspace")
    .maybeSingle();
  const settings = (data?.metadata || {}) as Settings;

  const apollo = await searchApollo(settings, requested || "");
  return NextResponse.json({
    query: requested || settings.keywords || settings.revenueTargets || "",
    source: "apollo",
    items: apollo.items,
    error: apollo.error || undefined,
    filters: {
      locations: splitList(settings.locations),
      employeeRanges: splitList(settings.employeeRanges),
      keywords: splitList(requested || settings.keywords || settings.revenueTargets),
    },
  });
}
