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

async function gmailToken(supabase: any, workspaceId: string, sessionToken?: string | null) {
  const stored = await getGmailIntegrationToken(supabase, workspaceId);
  let token = sessionToken || stored.token;
  if (!token && stored.refresh) {
    const renewed = await refreshGoogleAccessToken(stored.refresh);
    if (renewed) {
      token = renewed.access_token;
      await supabase.from("integrations").upsert(
        {
          workspace_id: workspaceId,
          provider: "gmail",
          status: "connected",
          metadata: {
            email: stored.email,
            access_token: token,
            refresh_token: stored.refresh,
            expiry: Date.now() + renewed.expires_in * 1000,
          },
        },
        { onConflict: "workspace_id,provider" }
      );
    }
  }
  return { token, email: stored.email };
}

async function readMessage(token: string, id: string) {
  const url = new URL(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}`);
  url.searchParams.set("format", "metadata");
  url.searchParams.append("metadataHeaders", "Subject");
  url.searchParams.append("metadataHeaders", "From");
  url.searchParams.append("metadataHeaders", "Date");
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const message = await response.json();
  const headers: Record<string, string> = {};
  for (const header of message.payload?.headers || []) {
    headers[String(header.name).toLowerCase()] = header.value;
  }
  return {
    id,
    subject: decodeEntities(headers.subject || "(No subject)"),
    from: decodeEntities(headers.from || ""),
    date: headers.date || "",
    snippet: decodeEntities(message.snippet || ""),
    unread: Array.isArray(message.labelIds) && message.labelIds.includes("UNREAD"),
  };
}

async function listThreads(token: string, query: string) {
  const listUrl = new URL("https://gmail.googleapis.com/gmail/v1/users/me/threads");
  listUrl.searchParams.set("q", query);
  listUrl.searchParams.set("maxResults", "15");
  const list = await fetch(listUrl, { headers: { Authorization: `Bearer ${token}` } });
  const payload = await list.json();
  if (!list.ok) throw new Error(payload.error?.message || "Gmail list failed");
  const threads = payload.threads || [];
  const details = await Promise.all(
    threads.map(async (thread: { id: string }) => {
      const threadUrl = new URL(`https://gmail.googleapis.com/gmail/v1/users/me/threads/${thread.id}`);
      threadUrl.searchParams.set("format", "metadata");
      threadUrl.searchParams.append("metadataHeaders", "Subject");
      threadUrl.searchParams.append("metadataHeaders", "From");
      threadUrl.searchParams.append("metadataHeaders", "Date");
      const response = await fetch(threadUrl, { headers: { Authorization: `Bearer ${token}` } });
      const body = await response.json();
      const last = body.messages?.[body.messages.length - 1];
      if (!last) return null;
      return readMessage(token, last.id);
    })
  );
  return details.filter(Boolean);
}

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const workspace = await getCurrentWorkspace();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!workspace) {
    return NextResponse.json({ connected: false, unread: [], reply: [], error: "No workspace" }, { status: 401 });
  }

  const { token, email } = await gmailToken(supabase, workspace.id, session?.provider_token);
  if (!token) {
    return NextResponse.json({ connected: false, email, unread: [], reply: [] });
  }

  try {
    const unread = await listThreads(token, "in:inbox is:unread -in:chats -category:promotions -category:social");
    const reply = await listThreads(token, "in:inbox newer_than:14d -from:me -in:chats");
    return NextResponse.json({ connected: true, email, unread, reply });
  } catch (error) {
    return NextResponse.json({
      connected: true,
      email,
      unread: [],
      reply: [],
      error: error instanceof Error ? error.message : "Gmail could not be read. Add Gmail again.",
    });
  }
}
