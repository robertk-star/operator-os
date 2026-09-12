import { NextResponse } from "next/server";
import { exchangeGoogleCode } from "@/lib/google";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

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
    const payload = {
      workspace_id: workspaceId,
      provider: "gmail",
      status: "connected",
      metadata: {
        user_id: userId,
        scope: tokens.scope,
        expiry: Date.now() + tokens.expires_in * 1000,
        has_refresh_token: Boolean(tokens.refresh_token),
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token || null,
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
