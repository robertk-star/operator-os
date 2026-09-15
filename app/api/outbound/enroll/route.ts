import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentWorkspace } from "@/lib/workspace";

export async function GET() {
  const workspace = await getCurrentWorkspace();
  if (!workspace) return NextResponse.json({ sequences: [], enrollments: [] }, { status: 401 });
  const supabase = await createSupabaseServerClient();
  const [{ data: sequences }, { data: enrollments }] = await Promise.all([
    supabase.from("outbound_sequences").select("id, name, status").eq("workspace_id", workspace.id).order("created_at", { ascending: false }),
    supabase.from("sequence_enrollments").select("id, sequence_id, contact_id, status").eq("workspace_id", workspace.id),
  ]);
  return NextResponse.json({ sequences: sequences || [], enrollments: enrollments || [] });
}

export async function POST(request: Request) {
  const workspace = await getCurrentWorkspace();
  if (!workspace) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const contactId = String(body.contactId || "");
  const sequenceId = String(body.sequenceId || "");
  if (!contactId || !sequenceId) return NextResponse.json({ error: "Pick a contact and a campaign." }, { status: 400 });

  const supabase = await createSupabaseServerClient();
  const [{ data: contact }, { data: sequence }] = await Promise.all([
    supabase.from("contacts").select("id, email, full_name").eq("id", contactId).eq("workspace_id", workspace.id).maybeSingle(),
    supabase.from("outbound_sequences").select("id, name, status").eq("id", sequenceId).eq("workspace_id", workspace.id).maybeSingle(),
  ]);
  if (!contact) return NextResponse.json({ error: "Contact not found." }, { status: 404 });
  if (!sequence) return NextResponse.json({ error: "Campaign not found." }, { status: 404 });
  if (!contact.email) return NextResponse.json({ error: "Add an email before enrolling." }, { status: 400 });

  const { data: existing } = await supabase
    .from("sequence_enrollments")
    .select("id, status")
    .eq("sequence_id", sequenceId)
    .eq("contact_id", contactId)
    .maybeSingle();
  if (existing) {
    await supabase.from("contacts").update({ drip_enrolled: true, drip_sequence_id: sequenceId, drip_sequence_name: sequence.name }).eq("id", contactId);
    return NextResponse.json({ enrollment: existing, already: true, sequence });
  }

  const inserted = await supabase
    .from("sequence_enrollments")
    .insert({ workspace_id: workspace.id, sequence_id: sequenceId, contact_id: contactId, status: "queued" })
    .select("id, sequence_id, contact_id, status")
    .single();
  if (inserted.error || !inserted.data) {
    return NextResponse.json({ error: inserted.error?.message || "Could not enroll." }, { status: 400 });
  }

  await supabase.from("contacts").update({ drip_enrolled: true, drip_sequence_id: sequenceId, drip_sequence_name: sequence.name }).eq("id", contactId);
  return NextResponse.json({ enrollment: inserted.data, sequence, already: false });
}
