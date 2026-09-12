import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentWorkspace } from "@/lib/workspace";

const EMPLOYEE_RANGES = ["501,1000", "1001,5000", "5001,10000", "10001+"];

function decode(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function parseDuckDuckGo(html: string) {
  const results: Array<{ name: string; url: string; snippet: string; employees?: string; location?: string; source: string }> = [];
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

async function searchApollo(query: string) {
  const key = process.env.APOLLO_API_KEY;
  if (!key) return { items: [], error: "APOLLO_API_KEY is missing in Vercel." };

  const response = await fetch("https://api.apollo.io/api/v1/mixed_companies/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-cache",
      "X-Api-Key": key,
    },
    body: JSON.stringify({
      page: 1,
      per_page: 10,
      organization_locations: ["United States"],
      organization_num_employees_ranges: EMPLOYEE_RANGES,
      q_organization_keyword_tags: query ? [query] : undefined,
    }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    return {
      items: [],
      error: payload.error || payload.message || `Apollo returned ${response.status}. People search is blocked on Free; company search should work.`,
    };
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
  return { items, error: items.length ? "" : "Apollo returned no companies for those filters." };
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
  const targets = String((data?.metadata as { revenueTargets?: string } | null)?.revenueTargets || "").trim();
  const query = requested || targets;

  const apollo = await searchApollo(query);
  if (apollo.items.length) {
    return NextResponse.json({ query: query || "US companies 500+ employees", source: "apollo", items: apollo.items });
  }

  if (!query) {
    return NextResponse.json({ query: "", items: [], error: apollo.error || "Set targets in Settings or type what you are looking for." });
  }

  const search = `${query} companies United States`;
  const response = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(search)}`, {
    headers: { "User-Agent": "OperatorOS/0.1" },
  });
  const html = await response.text();
  return NextResponse.json({
    query: search,
    source: "web",
    items: parseDuckDuckGo(html),
    error: apollo.error || undefined,
  });
}
