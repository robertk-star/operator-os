import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentWorkspace } from "@/lib/workspace";

function cleanUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const url = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
  if (!["http:", "https:"].includes(url.protocol)) return "";
  const host = url.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".local") || /^\d+\.\d+\.\d+\.\d+$/.test(host)) return "";
  return url.toString();
}

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

async function fetchPage(url: string) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "OperatorOS/0.1 research" },
      redirect: "follow",
    });
    const html = await response.text();
    return html.slice(0, 180000);
  } catch {
    return "";
  } finally {
    clearTimeout(timer);
  }
}

function pageText(html: string) {
  return decode(
    html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ")
  );
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
  const start = cleanUrl(contact.website || (org?.domain ? `https://${org.domain}` : ""));
  if (!start) return NextResponse.json({ error: "This contact has no website to research." }, { status: 400 });

  const root = new URL(start);
  const paths = [start, `${root.origin}/about`, `${root.origin}/contact`, `${root.origin}/contact-us`];
  let title = "";
  let description = "";
  let address = "";
  let blob = "";

  for (const path of paths) {
    const html = await fetchPage(path);
    if (!html) continue;
    if (!title) title = decode((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "").slice(0, 180));
    if (!description) description = decode((html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)/i)?.[1] || "").slice(0, 400));
    const text = pageText(html);
    blob += ` ${text}`;
    if (!address) address = findAddress(text);
  }

  const industry = contact.industry || guessIndustry(`${title} ${description} ${blob.slice(0, 2000)}`);
  const notes = [description || title, industry ? `Industry: ${industry}` : "", address ? `Address: ${address}` : ""]
    .filter(Boolean)
    .join("\n");

  const patch: Record<string, unknown> = {
    research_notes: notes,
    researched_at: new Date().toISOString(),
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
  return NextResponse.json({ notes, patch });
}
