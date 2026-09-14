import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentWorkspace } from "@/lib/workspace";

function uuid(value: unknown) {
  const text = String(value || "").trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text) ? text : null;
}

function legacyStatus(status: string) {
  if (status === "in_progress") return "doing";
  if (status === "completed") return "done";
  if (status === "cancelled" || status === "waiting") return status === "waiting" ? "open" : "stopped";
  if (["open", "doing", "done", "stopped"].includes(status)) return status;
  return "open";
}

export async function POST(request: Request) {
  const workspace = await getCurrentWorkspace();
  if (!workspace) return NextResponse.json({ error: "Not signed in. Refresh and log in again." }, { status: 401 });
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const title = String(body.title || "").trim();
  const dueDate = String(body.dueDate || "");
  const dueTime = String(body.dueTime || "09:00");
  if (!title) return NextResponse.json({ error: "Title is required." }, { status: 400 });
  const dueAt = dueDate ? new Date(`${dueDate}T${dueTime}:00`) : new Date();
  if (Number.isNaN(dueAt.getTime())) return NextResponse.json({ error: "Due date is invalid." }, { status: 400 });

  const requested = String(body.status || "open");
  const id = String(body.id || "");
  const select = "id, title, status, due_at, notes, created_at, updated_at";
  const core = {
    workspace_id: workspace.id,
    title,
    notes: String(body.description || ""),
    status: legacyStatus(requested),
    due_at: dueAt.toISOString(),
    owner_id: user.id,
    updated_at: new Date().toISOString(),
  };
  const full = {
    ...core,
    status: ["open", "in_progress", "waiting", "completed", "cancelled", "doing", "done", "stopped"].includes(requested) ? requested : "open",
    priority: String(body.priority || "normal"),
    waiting_on: String(body.waitingOn || "") || null,
    follow_up_date: String(body.followUpDate || "") || null,
    assigned_to: uuid(body.assignee) || user.id,
    completed_at: requested === "completed" || requested === "done" ? new Date().toISOString() : null,
  };

  async function write(row: Record<string, unknown>, columns: string) {
    return id
      ? supabase.from("tasks").update(row).eq("id", id).eq("workspace_id", workspace.id).select(columns).maybeSingle()
      : supabase.from("tasks").insert(row).select(columns).maybeSingle();
  }

  let result = await write(full, `${select}, priority, waiting_on, follow_up_date, completed_at, assigned_to, owner_id`);
  if (result.error) {
    result = await write(core, select);
  }
  if (result.error || !result.data) {
    return NextResponse.json(
      { error: result.error?.message || "Could not save task.", code: result.error?.code || null, workspace: workspace.name },
      { status: 400 }
    );
  }
  return NextResponse.json({ task: result.data, created: !id });
}
