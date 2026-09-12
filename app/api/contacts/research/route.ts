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
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function strip(html: string) {
  return decode(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
  );
}

function emailsIn(text: string) {
  return [...new Set((text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || []).map((item) => item.toLowerCase()))].slice(0, 8);
}

function linksIn(html: string, base: string) {
  const found = new Set<string>();
  const matches = html.matchAll(/href=["']([^"']+)["']/gi);
  for (const match of matches) {
    try {
      const url = new URL(match[1], base);
      const href = url.toString();
      if (/linkedin\.com|facebook\.com|instagram\.com|youtube\.com|twitter\.com|x\.com/i.test(href)) found.add(href.split("?")[0]);
    } catch {}
  }
  return [...found].slice(0, 8);
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

export async function POST(request: Request) {
  const workspace = await getCurrentWorkspace();
  if (!workspace) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const supabase = await createSupabaseServerClient();
  const { contactId } = await request.json().catch(() => ({ contactId: "" }));
  const { data: contact } = await supabase
    .from("contacts")
    .select("id, website, business_name, full_name, linkedin_url, email, organizations(domain)")
    .eq("workspace_id", workspace.id)
    .eq("id", contactId)
    .maybeSingle();
  if (!contact) return NextResponse.json({ error: "Contact not found." }, { status: 404 });

  const org = Array.isArray(contact.organizations) ? contact.organizations[0] : contact.organizations;
  const start = cleanUrl(contact.website || (org?.domain ? `https://${org.domain}` : ""));
  if (!start) return NextResponse.json({ error: "This contact has no website to research." }, { status: 400 });

  const root = new URL(start);
  const paths = [start, `${root.origin}/about`, `${root.origin}/about-us`, `${root.origin}/team`, `${root.origin}/company`];
  const pages: string[] = [];
  const emails = new Set<string>();
  const socials = new Set<string>();
  let title = "";
  let description = "";

  for (const path of paths) {
    const html = await fetchPage(path);
    if (!html) continue;
    pages.push(path);
    if (!title) title = decode((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "").slice(0, 180));
    if (!description) description = decode((html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)/i)?.[1] || "").slice(0, 400));
    emailsIn(html).forEach((item) => emails.add(item));
    linksIn(html, path).forEach((item) => socials.add(item));
  }

  const notes = [
    title ? `Title: ${title}` : "",
    description ? `Description: ${description}` : "",
    pages.length ? `Pages read: ${pages.join(", ")}` : "No pages could be fetched.",
    emails.size ? `Emails on site: ${[...emails].join(", ")}` : "No emails found on public pages.",
    socials.size ? `Profiles: ${[...socials].join(", ")}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const patch: Record<string, unknown> = {
    research_notes: notes,
    researched_at: new Date().toISOString(),
  };
  if (!contact.linkedin_url) {
    const linkedin = [...socials].find((item) => item.includes("linkedin.com"));
    if (linkedin) patch.linkedin_url = linkedin;
  }
  if (!contact.email) {
    const publicEmail = [...emails].find((item) => !/noreply|no-reply|donotreply/i.test(item));
    if (publicEmail) patch.email = publicEmail;
  }

  const { error } = await supabase.from("contacts").update(patch).eq("id", contact.id);
  if (error) {
    return NextResponse.json({ notes, warning: error.message });
  }
  return NextResponse.json({ notes, patch });
}
