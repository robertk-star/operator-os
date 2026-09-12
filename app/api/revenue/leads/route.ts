import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentWorkspace } from "@/lib/workspace";

type Settings = {
  revenueTargets?: string;
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
  if (!raw) return [];
  if (/^1000\+?$/i.test(raw.replace(/\s/g, "")) || /1000\+/.test(raw) && !raw.includes(",")) {
    return DEFAULT_1000_PLUS;
  }
  const tokens = raw.split(/[;\n]/).map((part) => part.trim().replace(/\s/g, "")).filter(Boolean);
  const ranges: string[] = [];
  for (const token of tokens) {
    if (/^\d+,\d+$/.test(token) || /^\d+\+$/.test(token)) {
      if (token === "1000+" || token === "1000") {
        for (const item of DEFAULT_1000_PLUS) if (!ranges.includes(item)) ranges.push(item);
        continue;
      }
      ranges.push(token);
      continue;
    }
    if (/^\d+$/.test(token)) {
      const n = Number(token);
      if (n >= 10000) ranges.push("10001+");
      else if (n >= 5000) ranges.push("5001,10000", "10001+");
      else if (n >= 1000) {
        for (const item of DEFAULT_1000_PLUS) if (!ranges.includes(item)) ranges.push(item);
      }
    }
  }
  return [...new Set(ranges)];
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
  const parts = [overrideQuery, settings.industries, settings.keywords, settings.locations, "companies 1000+ employees"].filter(Boolean);
  const query = parts.join(" ");
  const response = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
    headers: { "User-Agent": "OperatorOS/0.1" },
  });
  const html = await response.text();
  return { query, items: parseDuckDuckGo(html) };
}

async function searchApollo(settings: Settings, overrideQuery: string) {
  const key = process.env.APOLLO_API_KEY;
  if (!key) return { items: [], error: "APOLLO_API_KEY is missing in Vercel.", ranges: [] as string[] };

  const locations = splitList(settings.locations);
  const ranges = normalizeEmployeeRanges(settings.employeeRanges);
  const industries = splitList(settings.industries);
  const keywords = splitList(overrideQuery || settings.keywords);
  const tags = [...industries, ...keywords];

  if (!locations.length && !ranges.length && !tags.length) {
    return { items: [], error: "Set locations, employee ranges, industries, or keywords in Settings first.", ranges };
  }

  const body: Record<string, unknown> = { page: 1, per_page: 10 };
  if (locations.length) body.organization_locations = locations;
  if (ranges.length) body.organization_num_employees_ranges = ranges;
  if (tags.length) body.q_organization_keyword_tags = tags;

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
    return { items: [], error: payload.error || payload.message || `Apollo returned ${response.status}.`, ranges };
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
  return { items, error: items.length ? "" : "Apollo returned no companies for your Settings filters.", ranges };
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
  const filters = {
    locations: splitList(settings.locations),
    employeeRanges: apollo.ranges.length ? apollo.ranges : normalizeEmployeeRanges(settings.employeeRanges),
    industries: splitList(settings.industries),
    keywords: splitList(requested || settings.keywords),
  };

  if (apollo.items.length) {
    return NextResponse.json({
      query: requested || settings.keywords || settings.industries || "",
      source: "apollo",
      items: apollo.items,
      filters,
    });
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
