import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentWorkspace } from "@/lib/workspace";

function uuid(value: unknown) {
  const text = String(value || "").trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text) ? text : null;
}

export async function POST(request: Request) {
  const workspace = await getCurrentWorkspace();
  if (!workspace) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const body = await request.json().catch(() => ({}));
  const title = String(body.title || "").trim();
  const dueDate = String(body.dueDate || "");
  const dueTime = String(body.dueTime || "");
  if (!title) return NextResponse.json({ error: "Title is required." }, { status: 400 });
  if (!dueDate || !dueTime) return NextResponse.json({ error: "Due date and due time are required." }, { status: 400 });
  const dueAt = new Date(`${dueDate}T${dueTime}:00`);
  if (Number.isNaN(dueAt.getTime())) return NextResponse.json({ error: "Due date is invalid." }, { status: 400 });

  const row = {
    workspace_id: workspace.id,
    title,
    notes: String(body.description || ""),
    status: String(body.status || "open"),
    priority: String(body.priority || "normal"),
    due_at: dueAt.toISOString(),
    waiting_on: String(body.waitingOn || "") || null,
    follow_up_date: String(body.followUpDate || "") || null,
    assigned_to: uuid(body.assignee) || user?.id || null,
    owner_id: user?.id || null,
    completed_at: body.status === "completed" ? new Date().toISOString() : null,
    updated_at: new Date().toISOString(),
  };

  const id = String(body.id || "");
  const result = id
    ? await supabase.from("tasks").update(row).eq("id", id).eq("workspace_id", workspace.id).select("id, title, status, due_at, notes, priority, waiting_on, follow_up_date, completed_at, assigned_to, owner_id, created_at, updated_at").single()
    : await supabase.from("tasks").insert(row).select("id, title, status, due_at, notes, priority, waiting_on, follow_up_date, completed_at, assigned_to, owner_id, created_at, updated_at").single();

  if (result.error || !result.data) {
    return NextResponse.json({ error: result.error?.message || "Could not save task." }, { status: 400 });
  }
  return NextResponse.json({ task: result.data, created: !id });
}
