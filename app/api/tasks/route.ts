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
  if (status === "cancelled") return "stopped";
  if (status === "waiting") return "open";
  if (["open", "doing", "done", "stopped"].includes(status)) return status;
  return "open";
}

export async function GET() {
  const workspace = await getCurrentWorkspace();
  if (!workspace) return NextResponse.json({ tasks: [], error: "Not signed in." }, { status: 401 });
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("tasks")
    .select("id, title, status, due_at, notes, owner_id, created_at, updated_at")
    .eq("workspace_id", workspace.id)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ tasks: [], error: error.message }, { status: 400 });
  return NextResponse.json({ tasks: data || [], workspace: workspace.name });
}

export async function POST(request: Request) {
  const workspace = await getCurrentWorkspace();
  if (!workspace) return NextResponse.json({ error: "Not signed in. Refresh and log in again." }, { status: 401 });
  const workspaceId = workspace.id;
  const workspaceName = workspace.name;
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
  const select = "id, title, status, due_at, notes, owner_id, created_at, updated_at";
  const row = {
    workspace_id: workspaceId,
    title,
    notes: String(body.description || ""),
    status: legacyStatus(requested),
    due_at: dueAt.toISOString(),
    owner_id: user.id,
    updated_at: new Date().toISOString(),
  };

  const result = id
    ? await supabase.from("tasks").update(row).eq("id", id).eq("workspace_id", workspaceId).select(select).maybeSingle()
    : await supabase.from("tasks").insert(row).select(select).maybeSingle();

  if (result.error || !result.data) {
    return NextResponse.json(
      { error: result.error?.message || "Could not save task.", code: result.error?.code || null, workspace: workspaceName },
      { status: 400 }
    );
  }
  const { data: tasks } = await supabase.from("tasks").select(select).eq("workspace_id", workspaceId).order("created_at", { ascending: false });
  return NextResponse.json({ task: result.data, tasks: tasks || [result.data], created: !id, workspace: workspaceName });
}
