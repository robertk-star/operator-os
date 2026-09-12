import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getGoogleOAuthConfig, googleAuthorizeUrl } from "@/lib/google";
import { getCurrentWorkspace } from "@/lib/workspace";

export async function GET() {
  const { configured } = getGoogleOAuthConfig();
  if (!configured) {
    return NextResponse.json(
      { error: "Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in Vercel, then redeploy." },
      { status: 400 }
    );
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const workspace = await getCurrentWorkspace();
  if (!user || !workspace) {
    return NextResponse.redirect(new URL("/login", process.env.GOOGLE_REDIRECT_URI || "https://operator-os-rdk1.vercel.app"));
  }

  const state = Buffer.from(JSON.stringify({ workspaceId: workspace.id, userId: user.id })).toString("base64url");
  return NextResponse.redirect(googleAuthorizeUrl(state));
}
