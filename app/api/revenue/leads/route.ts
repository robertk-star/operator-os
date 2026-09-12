import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentWorkspace } from "@/lib/workspace";

type Settings = {
  locations?: string;
  employeeRanges?: string;
  keywords?: string;
  industries?: string;
};

const DEFAULT_1000_PLUS = ["1001,5000", "5001,10000", "10001+"];

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
    if (/^\d+,\d+$/.test(token) || /^\d{2,}\+$/.test(token)) {
      ranges.push(token);
    }
  }
  return ranges.length ? [...new Set(ranges)] : DEFAULT_1000_PLUS;
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
  const locations = splitList(settings.locations);
  const ranges = normalizeEmployeeRanges(settings.employeeRanges);
  const industries = splitList(settings.industries);
  const keywords = splitList(requested || settings.keywords);
  const tags = [...industries, ...keywords];
  const filters = { locations, employeeRanges: ranges, industries, keywords };

  const key = process.env.APOLLO_API_KEY;
  if (!key) {
    return NextResponse.json({ source: "none", items: [], error: "APOLLO_API_KEY missing.", filters });
  }

  const body: Record<string, unknown> = { page: 1, per_page: 10 };
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
      sent: body,
    });
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

  return NextResponse.json({
    source: "apollo",
    items,
    error: items.length ? "" : "Apollo returned no companies for those filters.",
    filters,
  });
}
