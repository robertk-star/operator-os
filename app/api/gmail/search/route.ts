import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentWorkspace } from "@/lib/workspace";
import { getGmailIntegrationToken, refreshGoogleAccessToken } from "@/lib/googleTokens";

function decodeEntities(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

async function tokenFor(supabase: any, workspaceId: string, sessionToken?: string | null) {
  const stored = await getGmailIntegrationToken(supabase, workspaceId);
  let token = sessionToken || stored.token;
  if (!token && stored.refresh) {
    const renewed = await refreshGoogleAccessToken(stored.refresh);
    if (renewed?.access_token) token = renewed.access_token;
  }
  return { token, email: stored.email };
}

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q")?.trim();
  if (!q) return NextResponse.json({ items: [], error: "Missing search" }, { status: 400 });

  const supabase = await createSupabaseServerClient();
  const workspace = await getCurrentWorkspace();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!workspace) return NextResponse.json({ items: [] }, { status: 401 });

  const { token } = await tokenFor(supabase, workspace.id, session?.provider_token);
  if (!token) return NextResponse.json({ items: [], error: "Add Gmail first." }, { status: 401 });

  const listUrl = new URL("https://gmail.googleapis.com/gmail/v1/users/me/threads");
  listUrl.searchParams.set("q", q);
  listUrl.searchParams.set("maxResults", "15");
  const list = await fetch(listUrl, { headers: { Authorization: `Bearer ${token}` } });
  const payload = await list.json();
  if (!list.ok) {
    return NextResponse.json({ items: [], error: payload.error?.message || "Search failed" }, { status: 400 });
  }

  const items = [];
  for (const thread of payload.threads || []) {
    const threadUrl = new URL(`https://gmail.googleapis.com/gmail/v1/users/me/threads/${thread.id}`);
    threadUrl.searchParams.set("format", "metadata");
    threadUrl.searchParams.append("metadataHeaders", "Subject");
    threadUrl.searchParams.append("metadataHeaders", "From");
    threadUrl.searchParams.append("metadataHeaders", "Date");
    const response = await fetch(threadUrl, { headers: { Authorization: `Bearer ${token}` } });
    const body = await response.json();
    const last = body.messages?.[body.messages.length - 1];
    if (!last) continue;
    const headers: Record<string, string> = {};
    for (const header of last.payload?.headers || []) {
      headers[String(header.name).toLowerCase()] = header.value;
    }
    items.push({
      id: last.id,
      subject: decodeEntities(headers.subject || "(No subject)"),
      from: decodeEntities(headers.from || ""),
      date: headers.date || "",
      snippet: decodeEntities(last.snippet || ""),
    });
  }

  return NextResponse.json({ items, query: q });
}
