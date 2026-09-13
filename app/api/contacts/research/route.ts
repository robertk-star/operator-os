import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentWorkspace } from "@/lib/workspace";

const BROWSER =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";

function decode(value: string) {
  return value
    .replace(/&/g, "&")
    .replace(/"/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/'/g, "'")
    .replace(/</g, "<")
    .replace(/>/g, ">")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/\s+/g, " ")
    .trim();
}

function guessIndustry(text: string) {
  const value = text.toLowerCase();
  const rules: Array<[RegExp, string]> = [
    [/staffing|recruit|talent solutions|workforce/, "Staffing & Recruiting"],
    [/warehous|fulfillment|distribution|logistics|supply chain|freight|trucking/, "Logistics and Supply Chain"],
    [/manufactur|industrial|factory/, "Manufacturing"],
    [/retail|wholesale|grocery|store/, "Retail"],
    [/hospitality|hotel|restaurant/, "Hospitality"],
    [/construct|building/, "Construction"],
    [/food production|foodservice|beverage/, "Food Production"],
    [/marketing|creative agency|advertis/, "Marketing & Advertising"],
    [/software|saas|technology|digital/, "Information Technology"],
  ];
  return rules.find(([pattern]) => pattern.test(value))?.[1] || "";
}

function findAddress(text: string) {
  const match = text.match(/\d{1,6}\s+[A-Za-z0-9.'\- ]{3,40},\s*[A-Za-z.'\- ]{2,30},\s*[A-Z]{2}\s+\d{5}(?:-\d{4})?/);
  return match?.[0] || "";
}

function isParked(text: string) {
  return /domain is for sale|buy this domain|parked free|sedoparking|this domain is registered|account suspended/.test(text.toLowerCase());
}

function variants(raw: string) {
  try {
    const url = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
    const host = url.hostname.replace(/^www\./, "");
    return [`https://www.${host}`, `https://${host}`];
  } catch {
    return [];
  }
}

async function fetchUrl(url: string) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": BROWSER, Accept: "text/html,application/xhtml+xml,text/plain" },
      redirect: "follow",
    });
    const html = (await response.text()).slice(0, 180000);
    return { status: response.status, html, error: "" };
  } catch (error) {
    return { status: 0, html: "", error: error instanceof Error ? error.message : "failed" };
  } finally {
    clearTimeout(timer);
  }
}

function pageText(html: string) {
  return decode(html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " "));
}

export async function POST(request: Request) {
  const workspace = await getCurrentWorkspace();
  if (!workspace) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const supabase = await createSupabaseServerClient();
  const { contactId } = await request.json().catch(() => ({ contactId: "" }));
  const { data: contact } = await supabase
    .from("contacts")
    .select("id, website, industry, street_address, city, state, postal_code, country, organizations(domain)")
    .eq("workspace_id", workspace.id)
    .eq("id", contactId)
    .maybeSingle();
  if (!contact) return NextResponse.json({ error: "Contact not found." }, { status: 404 });

  const org = Array.isArray(contact.organizations) ? contact.organizations[0] : contact.organizations;
  const seeds = variants(contact.website || org?.domain || "");
  if (!seeds.length) return NextResponse.json({ error: "This contact has no website to research." }, { status: 400 });

  let working = "";
  let blob = "";
  let title = "";
  let description = "";
  const attempts: string[] = [];

  for (const seed of seeds) {
    const direct = await fetchUrl(seed);
    let html = direct.html;
    let via = "direct";
    if (direct.status === 0 || html.length < 200) {
      const reader = await fetchUrl(`https://r.jina.ai/${seed}`);
      html = reader.html;
      via = "reader";
      attempts.push(`${seed} direct ${direct.status || direct.error || "fail"}; reader ${reader.status}`);
    } else {
      attempts.push(`${seed} direct ${direct.status}`);
    }
    const text = pageText(html);
    if (html.length < 200 || isParked(text)) continue;
    working = seed;
    blob = text;
    title = decode((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "").slice(0, 180)) || text.slice(0, 120);
    description = decode((html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)/i)?.[1] || "").slice(0, 400)) || text.slice(0, 400);
    if (via) break;
  }

  if (!working) {
    const notes = `No working website.\n${attempts.join("\n")}`;
    const patch = { research_notes: notes, researched_at: new Date().toISOString() };
    await supabase.from("contacts").update(patch).eq("id", contact.id);
    return NextResponse.json({ notes, patch, error: notes }, { status: 422 });
  }

  const address = findAddress(blob);
  const industry = contact.industry || guessIndustry(`${title} ${description} ${blob.slice(0, 2000)}`);
  const notes = [description || title, industry ? `Industry: ${industry}` : "", address ? `Address: ${address}` : "", `Website: ${working}`]
    .filter(Boolean)
    .join("\n");

  const patch: Record<string, unknown> = {
    research_notes: notes,
    researched_at: new Date().toISOString(),
    website: working,
  };
  if (industry) patch.industry = industry;
  if (address && !contact.street_address) {
    const parts = address.split(",").map((part) => part.trim());
    patch.street_address = parts[0] || address;
    if (parts[1]) patch.city = parts[1];
    const stateZip = parts[2] || "";
    const stateMatch = stateZip.match(/^([A-Z]{2})\s+(\d{5}(?:-\d{4})?)$/);
    if (stateMatch) {
      patch.state = stateMatch[1];
      patch.postal_code = stateMatch[2];
    }
    if (!contact.country) patch.country = "United States";
  }

  const { error } = await supabase.from("contacts").update(patch).eq("id", contact.id);
  if (error) return NextResponse.json({ notes, warning: error.message, patch });
  return NextResponse.json({ notes, patch, attempts });
}
