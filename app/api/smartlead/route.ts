import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentWorkspace } from "@/lib/workspace";

const SMARTLEAD = "https://server.smartlead.ai/api/v1";

async function loadConnection(supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>, workspaceId: string) {
  const { data } = await supabase.from("integrations").select("id, status, metadata").eq("workspace_id", workspaceId).eq("provider", "smartlead").maybeSingle();
  return data;
}

export async function GET() {
  const workspace = await getCurrentWorkspace();
  if (!workspace) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const supabase = await createSupabaseServerClient();
  const row = await loadConnection(supabase, workspace.id);
  const metadata = (row?.metadata || {}) as { connectionMode?: string; accounts?: unknown[]; credentialStored?: boolean; lastError?: string };
  return NextResponse.json({
    connection: row
      ? {
          id: row.id,
          connectionMode: metadata.connectionMode || "customer_owned",
          status: row.status,
          credentialStored: Boolean(metadata.credentialStored || process.env.SMARTLEAD_API_KEY),
          lastError: metadata.lastError || null,
        }
      : null,
    accounts: metadata.accounts || [],
    mailboxSetupUrl: "https://app.smartlead.ai/",
    canManage: workspace.role === "owner" || workspace.role === "admin" || workspace.mode === "personal",
  });
}

export async function POST(request: Request) {
  const workspace = await getCurrentWorkspace();
  if (!workspace) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const supabase = await createSupabaseServerClient();
  const body = await request.json().catch(() => ({}));
  const action = String(body.action || "");
  const existing = await loadConnection(supabase, workspace.id);
  const metadata = { ...((existing?.metadata || {}) as Record<string, unknown>) };

  if (action === "configure") {
    const apiKey = String(body.apiKey || metadata.apiKey || process.env.SMARTLEAD_API_KEY || "");
    if (!apiKey) return NextResponse.json({ error: "Paste a Smartlead API key." }, { status: 400 });
    const probe = await fetch(`${SMARTLEAD}/email-accounts/?api_key=${encodeURIComponent(apiKey)}`);
    if (!probe.ok) {
      return NextResponse.json({ error: "Smartlead rejected that key." }, { status: 400 });
    }
    const nextMeta = {
      ...metadata,
      apiKey,
      connectionMode: body.connectionMode || "customer_owned",
      credentialStored: true,
      lastError: null,
    };
    const { error } = await supabase.from("integrations").upsert(
      { workspace_id: workspace.id, provider: "smartlead", status: "connected", metadata: nextMeta },
      { onConflict: "workspace_id,provider" }
    );
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  const apiKey = String(metadata.apiKey || process.env.SMARTLEAD_API_KEY || "");
  if (!apiKey) return NextResponse.json({ error: "Connect Smartlead first." }, { status: 400 });

  if (action === "sync_accounts") {
    const response = await fetch(`${SMARTLEAD}/email-accounts/?api_key=${encodeURIComponent(apiKey)}`);
    const payload = await response.json().catch(() => []);
    if (!response.ok) return NextResponse.json({ error: "Could not sync mailboxes." }, { status: 400 });
    const list = Array.isArray(payload) ? payload : payload.email_accounts || payload.data || [];
    const accounts = list.map((account: any) => ({
      id: String(account.id || account.email),
      email: account.from_email || account.email || account.username || "",
      from_name: account.from_name || account.name || "",
      status: account.status || (account.is_smtp_success ? "active" : "pending"),
      warmup_enabled: Boolean(account.warmup_enabled || account.is_warmup_enabled),
      daily_limit: account.message_per_day || account.daily_limit || null,
    }));
    await supabase.from("integrations").upsert(
      {
        workspace_id: workspace.id,
        provider: "smartlead",
        status: "connected",
        metadata: { ...metadata, accounts, lastSyncedAt: new Date().toISOString() },
      },
      { onConflict: "workspace_id,provider" }
    );
    return NextResponse.json({ synced: accounts.length, accounts });
  }

  if (action === "sync_replies") {
    return NextResponse.json({ imported: 0, readyToTalk: 0, warning: "Reply sync will use Smartlead webhooks next." });
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}
