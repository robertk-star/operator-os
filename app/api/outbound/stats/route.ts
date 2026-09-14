import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentWorkspace } from "@/lib/workspace";
import { smartleadRequest } from "@/lib/smartlead";

function rows(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) return value.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"));
  if (!value || typeof value !== "object") return [];
  const payload = value as Record<string, unknown>;
  for (const key of ["data", "leads", "results"]) {
    if (Array.isArray(payload[key])) return rows(payload[key]);
  }
  return [];
}

export async function GET(request: Request) {
  const workspace = await getCurrentWorkspace();
  if (!workspace) return NextResponse.json({ emailed: 0, completed: 0 });
  const sequenceId = new URL(request.url).searchParams.get("sequenceId") || "";
  const supabase = await createSupabaseServerClient();
  const { data: sequence } = sequenceId
    ? await supabase.from("outbound_sequences").select("id, external_campaign_id").eq("workspace_id", workspace.id).eq("id", sequenceId).maybeSingle()
    : { data: null };
  const { data: enrollments } = await supabase
    .from("sequence_enrollments")
    .select("status")
    .eq("workspace_id", workspace.id)
    .then(async (result) =>
      sequenceId
        ? supabase.from("sequence_enrollments").select("status").eq("workspace_id", workspace.id).eq("sequence_id", sequenceId)
        : result
    );
  const local = enrollments || [];
  let emailed = local.filter((row) => ["active", "sent", "completed"].includes(row.status)).length;
  let completed = local.filter((row) => row.status === "completed").length;

  const campaignId = String(sequence?.external_campaign_id || "");
  const { data: connection } = await supabase.from("integrations").select("status, metadata").eq("workspace_id", workspace.id).eq("provider", "smartlead").maybeSingle();
  const apiKey = String((connection?.metadata as { apiKey?: string } | null)?.apiKey || process.env.SMARTLEAD_API_KEY || "");
  if (campaignId && apiKey) {
    try {
      const payload = await smartleadRequest(apiKey, `/campaigns/${campaignId}/leads?offset=0&limit=100`);
      const leads = rows(payload);
      emailed = leads.filter((lead) => {
        const nested = (lead.lead && typeof lead.lead === "object" ? lead.lead : lead) as Record<string, unknown>;
        const status = String(lead.status || lead.email_status || nested.status || "").toLowerCase();
        return Boolean(lead.is_completed) || /sent|replied|completed|unsubscribed|bounced|opened/.test(status) || Number(lead.sent_count || nested.sent_count || 0) > 0;
      }).length;
      completed = leads.filter((lead) => {
        const nested = (lead.lead && typeof lead.lead === "object" ? lead.lead : lead) as Record<string, unknown>;
        const status = String(lead.status || nested.status || "").toLowerCase();
        return Boolean(lead.is_completed) || status === "completed" || status === "sequence_completed";
      }).length;
    } catch {
      // Keep local counts if Smartlead is unavailable.
    }
  }
  return NextResponse.json({ emailed, completed, added: local.length });
}
