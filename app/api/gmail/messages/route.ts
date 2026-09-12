import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentWorkspace } from "@/lib/workspace";
import { getGmailIntegrationToken, refreshGoogleAccessToken } from "@/lib/googleTokens";

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

async function listMessages(token: string, query: string) {
  const listUrl = new URL("https://gmail.googleapis.com/gmail/v1/users/me/messages");
  listUrl.searchParams.set("q", query);
  listUrl.searchParams.set("maxResults", "15");
  const list = await fetch(listUrl, { headers: { Authorization: `Bearer ${token}` } });
  const payload = await list.json();
  if (!list.ok) throw new Error(payload.error?.message || "Gmail list failed");
  const ids = (payload.messages || []).map((item: { id: string }) => item.id);
  const details = await Promise.all(
    ids.map(async (id: string) => {
      const url = new URL(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}`);
      url.searchParams.set("format", "metadata");
      url.searchParams.set("metadataHeaders", "Subject");
      url.searchParams.set("metadataHeaders", "From");
      url.searchParams.set("metadataHeaders", "Date");
      const response = await fetch(url.toString(), { headers: { Authorization: `Bearer ${token}` } });
      const message = await response.json();
      const headers = Object.fromEntries(
        (message.payload?.headers || []).map((header: { name: string; value: string }) => [header.name.toLowerCase(), header.value])
      );
      return {
        id,
        subject: headers.subject || "(No subject)",
        from: headers.from || "",
        date: headers.date || "",
        snippet: message.snippet || "",
        unread: Array.isArray(message.labelIds) && message.labelIds.includes("UNREAD"),
      };
    })
  );
  return details;
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
    const [unread, reply] = await Promise.all([
      listMessages(token, "is:unread newer_than:21d"),
      listMessages(token, "is:inbox newer_than:21d -from:me"),
    ]);
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
