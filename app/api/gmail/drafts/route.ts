import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentWorkspace } from "@/lib/workspace";
import { getGmailIntegrationToken, refreshGoogleAccessToken } from "@/lib/googleTokens";

function toBase64Url(value: string) {
  return Buffer.from(value).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function tokenFor(supabase: any, workspaceId: string, sessionToken?: string | null) {
  const stored = await getGmailIntegrationToken(supabase, workspaceId);
  let token = sessionToken || stored.token;
  if (!token && stored.refresh) {
    const renewed = await refreshGoogleAccessToken(stored.refresh);
    if (renewed?.access_token) token = renewed.access_token;
  }
  return token;
}

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const workspace = await getCurrentWorkspace();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!workspace) return NextResponse.json({ error: "No workspace" }, { status: 401 });

  const token = await tokenFor(supabase, workspace.id, session?.provider_token);
  if (!token) return NextResponse.json({ error: "Add Gmail first." }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const to = String(body.to || "").trim();
  const subject = String(body.subject || "").trim();
  const text = String(body.text || "").trim();
  if (!to || !subject || !text) {
    return NextResponse.json({ error: "Draft needs to, subject, and body." }, { status: 400 });
  }

  const rfc822 = [`To: ${to}`, `Subject: ${subject}`, "Content-Type: text/plain; charset=utf-8", "", text].join("\r\n");
  const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/drafts", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ message: { raw: toBase64Url(rfc822) } }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    return NextResponse.json({ error: payload.error?.message || "Could not create Gmail draft." }, { status: 400 });
  }
  return NextResponse.json({ ok: true, draftId: payload.id });
}
