import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentWorkspace } from "@/lib/workspace";
import { getGmailIntegrationToken, refreshGoogleAccessToken } from "@/lib/googleTokens";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const start = searchParams.get("start");
  const end = searchParams.get("end");
  const supabase = await createSupabaseServerClient();
  const workspace = await getCurrentWorkspace();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!workspace) {
    return NextResponse.json({ connected: false, items: [], error: "No workspace" }, { status: 401 });
  }

  let stored = await getGmailIntegrationToken(supabase, workspace.id);
  let token = session?.provider_token || stored.token;
  const refresh = stored.refresh;

  if (!token && refresh) {
    const renewed = await refreshGoogleAccessToken(refresh);
    if (renewed) {
      token = renewed.access_token;
      await supabase.from("integrations").upsert(
        {
          workspace_id: workspace.id,
          provider: "gmail",
          status: "connected",
          metadata: {
            ...(stored.email ? { email: stored.email } : {}),
            access_token: token,
            refresh_token: refresh,
            expiry: Date.now() + renewed.expires_in * 1000,
          },
        },
        { onConflict: "workspace_id,provider" }
      );
    }
  }

  if (!token) {
    return NextResponse.json({ connected: false, items: [], email: stored.email });
  }

  const url = new URL("https://www.googleapis.com/calendar/v3/calendars/primary/events");
  url.searchParams.set("singleEvents", "true");
  url.searchParams.set("orderBy", "startTime");
  url.searchParams.set("maxResults", "250");
  if (start) url.searchParams.set("timeMin", start);
  if (end) url.searchParams.set("timeMax", end);

  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    return NextResponse.json({
      connected: true,
      items: [],
      email: stored.email,
      error: payload.error?.message || "Google Calendar could not be read. Add Gmail again.",
    });
  }

  const items = (payload.items || []).map((event: any) => ({
    id: `google-${event.id}`,
    title: event.summary || "(No title)",
    start: event.start?.dateTime || event.start?.date,
    end: event.end?.dateTime || event.end?.date || null,
    kind: "appointment",
    source: "google",
  }));

  return NextResponse.json({ connected: true, email: stored.email, items });
}
