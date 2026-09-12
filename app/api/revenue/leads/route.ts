import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentWorkspace } from "@/lib/workspace";

function decode(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function parseDuckDuckGo(html: string) {
  const results: Array<{ name: string; url: string; snippet: string }> = [];
  const blocks = html.split('class="result');
  for (const block of blocks.slice(1)) {
    const href = block.match(/uddg=([^"&]+)/)?.[1] || block.match(/href="(https?:\/\/[^"&]+)"/)?.[1];
    const title = block.match(/class="result__a"[^>]*>([\s\S]*?)<\/a>/)?.[1];
    const snippet = block.match(/class="result__snippet"[^>]*>([\s\S]*?)<\/a>/)?.[1] || block.match(/class="result__snippet"[^>]*>([\s\S]*?)<\//)?.[1];
    if (!href || !title) continue;
    const url = decodeURIComponent(href).replace(/<[^>]+>/g, "");
    const name = decode(title.replace(/<[^>]+>/g, "")).trim();
    if (!name || results.some((item) => item.url === url)) continue;
    results.push({
      name,
      url,
      snippet: decode((snippet || "").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim(),
    });
    if (results.length >= 10) break;
  }
  return results;
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
  if (!query) {
    return NextResponse.json({ query: "", items: [], error: "Set Revenue Engine targets in Settings first." });
  }

  const search = `${query} companies`;
  const response = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(search)}`, {
    headers: { "User-Agent": "OperatorOS/0.1" },
  });
  const html = await response.text();
  const items = parseDuckDuckGo(html);
  return NextResponse.json({ query: search, items });
}
