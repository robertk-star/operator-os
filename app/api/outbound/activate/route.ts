import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentWorkspace } from "@/lib/workspace";
import { smartleadRequest, toSmartleadBody } from "@/lib/smartlead";

function text(value: unknown) {
  return String(value || "").trim();
}

export async function POST(request: Request) {
  const workspace = await getCurrentWorkspace();
  if (!workspace) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const supabase = await createSupabaseServerClient();
  const body = await request.json().catch(() => ({}));
  const action = text(body.action) || "activate";
  const sequenceId = text(body.sequenceId);
  if (!sequenceId) return NextResponse.json({ error: "Sequence is required." }, { status: 400 });

  const { data: connection } = await supabase.from("integrations").select("status, metadata").eq("workspace_id", workspace.id).eq("provider", "smartlead").maybeSingle();
  const metadata = (connection?.metadata || {}) as { apiKey?: string; accounts?: { id: string; email: string }[] };
  const apiKey = metadata.apiKey || process.env.SMARTLEAD_API_KEY || "";
  if (!apiKey || connection?.status !== "connected") {
    return NextResponse.json({ error: "Connect Smartlead in Admin first." }, { status: 400 });
  }

  const { data: sequence } = await supabase.from("outbound_sequences").select("*").eq("workspace_id", workspace.id).eq("id", sequenceId).maybeSingle();
  if (!sequence) return NextResponse.json({ error: "Sequence not found." }, { status: 404 });
  const { data: steps } = await supabase.from("outbound_sequence_steps").select("*").eq("sequence_id", sequenceId).order("step_order");
  if (!steps?.length) return NextResponse.json({ error: "Add at least one message step." }, { status: 400 });

  const selectedIds: string[] = Array.isArray(sequence.sending_account_ids) ? sequence.sending_account_ids : [];
  const accounts = (metadata.accounts || []).filter((account) => selectedIds.includes(String(account.id)));
  const emailAccountIds = accounts.map((account) => Number(account.id)).filter(Boolean);
  if (!emailAccountIds.length) {
    return NextResponse.json({ error: "Select at least one synced Smartlead mailbox, save the draft, then activate." }, { status: 400 });
  }

  if (action === "pause" || action === "stop" || action === "resume") {
    const campaignId = text(sequence.external_campaign_id);
    if (!campaignId) return NextResponse.json({ error: "This sequence is not in Smartlead yet." }, { status: 400 });
    const status = action === "pause" ? "PAUSED" : action === "stop" ? "STOPPED" : "START";
    await smartleadRequest(apiKey, `/campaigns/${campaignId}/status`, { method: "POST", body: JSON.stringify({ status }) });
    const next = action === "resume" ? "active" : action === "pause" ? "paused" : "stopped";
    await supabase.from("outbound_sequences").update({ status: next, last_error: null }).eq("id", sequenceId);
    return NextResponse.json({ status: next });
  }

  const tags = (sequence.audience_tags || []) as string[];
  let peopleQuery = supabase.from("contacts").select("id, first_name, last_name, email, business_name, job_title, phone, website, city, state, country, tags, status, record_type").eq("workspace_id", workspace.id).eq("record_type", "person");
  const { data: people } = await peopleQuery;
  const matchMode = sequence.tag_match_mode === "all" ? "all" : "any";
  const eligible = (people || []).filter((person) => {
    if ((person.status || "active") !== "active") return false;
    if (!person.email) return false;
    if (!tags.length) return true;
    const have = (person.tags || []).map((item: string) => item.toLowerCase());
    return matchMode === "all" ? tags.every((tag: string) => have.includes(String(tag).toLowerCase())) : tags.some((tag: string) => have.includes(String(tag).toLowerCase()));
  });
  if (!eligible.length) return NextResponse.json({ error: "No people with emails match those tags." }, { status: 400 });

  let campaignId = text(sequence.external_campaign_id);
  try {
    if (!campaignId) {
      const created = await smartleadRequest<{ id?: string; data?: { id?: string } }>(apiKey, "/campaigns/create", {
        method: "POST",
        body: JSON.stringify({ name: sequence.name }),
      });
      campaignId = text(created.id || created.data?.id);
      if (!campaignId) throw new Error("Smartlead did not return a campaign ID.");
      await supabase.from("outbound_sequences").update({ external_campaign_id: campaignId }).eq("id", sequenceId);
    }
    await smartleadRequest(apiKey, `/campaigns/${campaignId}/sequences`, {
      method: "POST",
      body: JSON.stringify({
        sequences: steps.map((step, index) => ({
          id: null,
          seq_number: index + 1,
          subject: step.subject,
          email_body: toSmartleadBody(String(step.body_text)),
          seq_delay_details: { delay_in_days: Number(step.delay_days) || 0 },
        })),
      }),
    });
    const days = ((sequence.sending_days || [1, 2, 3, 4, 5]) as number[]).map((day) => Number(day) % 7);
    await smartleadRequest(apiKey, `/campaigns/${campaignId}/schedule`, {
      method: "POST",
      body: JSON.stringify({
        timezone: sequence.time_zone || "America/Chicago",
        days_of_the_week: days,
        start_hour: String(sequence.start_hour || "09:00").slice(0, 5),
        end_hour: String(sequence.end_hour || "16:00").slice(0, 5),
        min_time_btw_emails: sequence.min_minutes_between_emails || 15,
        max_new_leads_per_day: sequence.max_leads_per_day || 25,
      }),
    });
    await smartleadRequest(apiKey, `/campaigns/${campaignId}/settings`, {
      method: "POST",
      body: JSON.stringify({
        track_settings: ["DONT_TRACK_EMAIL_OPEN", "DONT_TRACK_LINK_CLICK"],
        stop_lead_settings: "REPLY_TO_AN_EMAIL",
        unsubscribe_text: `${sequence.unsubscribe_text || "Reply unsubscribe to stop future messages."}\n${sequence.sender_postal_address || ""}`,
        send_as_plain_text: false,
        follow_up_percentage: 100,
      }),
    });
    await smartleadRequest(apiKey, `/campaigns/${campaignId}/email-accounts`, {
      method: "POST",
      body: JSON.stringify({ email_account_ids: emailAccountIds }),
    });
    for (let start = 0; start < eligible.length; start += 100) {
      const group = eligible.slice(start, start + 100);
      await smartleadRequest(apiKey, `/campaigns/${campaignId}/leads`, {
        method: "POST",
        body: JSON.stringify({
          lead_list: group.map((person) => ({
            email: person.email,
            first_name: person.first_name || "",
            last_name: person.last_name || "",
            company_name: person.business_name || "",
            phone_number: person.phone || "",
            website: person.website || "",
            location: [person.city, person.state, person.country].filter(Boolean).join(", "),
            custom_fields: { title: person.job_title || "", operatoros_contact_id: person.id },
          })),
          settings: { ignore_global_block_list: false },
        }),
      });
    }
    await smartleadRequest(apiKey, `/campaigns/${campaignId}/status`, { method: "POST", body: JSON.stringify({ status: "START" }) });
    await supabase.from("outbound_sequences").update({ status: "active", last_error: null, external_campaign_id: campaignId }).eq("id", sequenceId);
    return NextResponse.json({ status: "active", campaignId, enrolled: eligible.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not publish sequence";
    await supabase.from("outbound_sequences").update({ status: "error", last_error: message, ...(campaignId ? { external_campaign_id: campaignId } : {}) }).eq("id", sequenceId);
    return NextResponse.json({ error: message, campaignId: campaignId || null }, { status: 502 });
  }
}
