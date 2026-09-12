import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentWorkspace } from "@/lib/workspace";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/setup";

  if (code) {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.exchangeCodeForSession(code);
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const workspace = await getCurrentWorkspace();
    if (session?.provider_token && workspace) {
      await supabase.from("integrations").upsert(
        {
          workspace_id: workspace.id,
          provider: "gmail",
          status: "connected",
          metadata: {
            user_id: session.user.id,
            email: session.user.email,
            has_provider_token: true,
            provider_refresh_token: session.provider_refresh_token || null,
            access_token: session.provider_token,
          },
        },
        { onConflict: "workspace_id,provider" }
      );
    }
  }

  return NextResponse.redirect(`${origin}${next}`);
}
