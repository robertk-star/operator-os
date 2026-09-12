import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentWorkspace } from "@/lib/workspace";

type Settings = {
  revenueTargets?: string;
  locations?: string;
  employeeRanges?: string;
  keywords?: string;
};

function splitList(value: string | undefined) {
  return String(value || "")
    .split(/[;\n]/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function decode(value: string) {
  return value
    .replace(/&/g, "&")
    .replace(/"/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/</g, "<")
    .replace(/>/g, ">");
}

function parseDuckDuckGo(html: string) {
  const results: Array<{ name: string; url: string; snippet: string; source: string }> = [];
  const blocks = html.split('class="result');
  for (const block of blocks.slice(1)) {
    const href = block.match(/uddg=([^"&]+)/)?.[1] || block.match(/href="(https?:\/\/[^"&]+)"/)?.[1];
    const title = block.match(/class="result__a"[^>]*>([\s\S]*?)<\/a>/)?.[1];
    const snippet = block.match(/class="result__snippet"[^>]*>([\s\S]*?)<\//)?.[1];
    if (!href || !title) continue;
    const url = decodeURIComponent(href).replace(/<[^>]+>/g, "");
    const name = decode(title.replace(/<[^>]+>/g, "")).trim();
    if (!name || results.some((item) => item.url === url)) continue;
    results.push({
      name,
      url,
      snippet: decode((snippet || "").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim(),
      source: "web",
    });
    if (results.length >= 10) break;
  }
  return results;
}

async function searchWeb(settings: Settings, overrideQuery: string) {
  const parts = [
    overrideQuery,
    settings.keywords,
    settings.locations,
    settings.employeeRanges ? `${settings.employeeRanges} employees` : "",
    settings.revenueTargets,
    "companies",
  ].filter(Boolean);
  const query = parts.join(" ");
  const response = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
    headers: { "User-Agent": "OperatorOS/0.1" },
  });
  const html = await response.text();
  return { query, items: parseDuckDuckGo(html) };
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

  const body: Record<string, unknown> = { page: 1, per_page: 10 };
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
  const filters = {
    locations: splitList(settings.locations),
    employeeRanges: splitList(settings.employeeRanges),
    keywords: splitList(requested || settings.keywords || settings.revenueTargets),
  };

  const apollo = await searchApollo(settings, requested || "");
  if (apollo.items.length) {
    return NextResponse.json({ query: requested || settings.keywords || "", source: "apollo", items: apollo.items, filters });
  }

  const web = await searchWeb(settings, requested || "");
  return NextResponse.json({
    query: web.query,
    source: "web",
    items: web.items,
    error: apollo.error
      ? `${apollo.error} Using web search instead. Web results do not guarantee employee count.`
      : undefined,
    filters,
  });
}
