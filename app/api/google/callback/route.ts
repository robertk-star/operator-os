import { NextResponse } from "next/server";
import { exchangeGoogleCode } from "@/lib/google";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

async function googleEmail(accessToken: string) {
  const response = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const payload = await response.json().catch(() => ({}));
  return String(payload.email || "");
}

export async function GET(request: Request) {
  const origin = new URL(request.url).origin;
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const stateRaw = searchParams.get("state");
  const error = searchParams.get("error");

  if (error || !code || !stateRaw) {
    return NextResponse.redirect(`${origin}/app/email?google=denied`);
  }

  let workspaceId = "";
  let userId = "";
  try {
    const parsed = JSON.parse(Buffer.from(stateRaw, "base64url").toString());
    workspaceId = parsed.workspaceId;
    userId = parsed.userId;
  } catch {
    return NextResponse.redirect(`${origin}/app/email?google=bad_state`);
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || user.id !== userId) {
    return NextResponse.redirect(`${origin}/login`);
  }

  try {
    const tokens = await exchangeGoogleCode(code);
    const email = await googleEmail(tokens.access_token);
    const { data: existing } = await supabase.from("integrations").select("metadata").eq("workspace_id", workspaceId).eq("provider", "gmail").maybeSingle();
    const previous = (existing?.metadata || {}) as { accounts?: Array<Record<string, unknown>>; refresh_token?: string };
    const accounts = Array.isArray(previous.accounts) ? previous.accounts : [];
    const nextAccount = {
      email,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token || accounts.find((item) => item.email === email)?.refresh_token || previous.refresh_token || null,
      expiry: Date.now() + tokens.expires_in * 1000,
    };
    const payload = {
      workspace_id: workspaceId,
      provider: "gmail",
      status: "connected",
      metadata: {
        user_id: userId,
        email,
        scope: tokens.scope,
        expiry: nextAccount.expiry,
        has_refresh_token: Boolean(nextAccount.refresh_token),
        access_token: tokens.access_token,
        refresh_token: nextAccount.refresh_token,
        accounts: [...accounts.filter((item) => item.email !== email), nextAccount],
      },
    };

    try {
      const admin = getSupabaseAdmin();
      await admin.from("integrations").upsert(payload, { onConflict: "workspace_id,provider" });
    } catch {
      await supabase.from("integrations").upsert(payload, { onConflict: "workspace_id,provider" });
    }
  } catch {
    return NextResponse.redirect(`${origin}/app/email?google=token_failed`);
  }

  return NextResponse.redirect(`${origin}/app/email?google=connected`);
}
