import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentWorkspace } from "@/lib/workspace";
import { CalendarWorkspace } from "./CalendarWorkspace";

export default async function CalendarPage() {
  const workspace = await getCurrentWorkspace();
  const supabase = await createSupabaseServerClient();
  const [{ data: events }, { data: tasks }] = workspace
    ? await Promise.all([
        supabase.from("calendar_events").select("id, title, starts_at, ends_at").eq("workspace_id", workspace.id),
        supabase.from("tasks").select("id, title, status, due_at").eq("workspace_id", workspace.id).not("due_at", "is", null),
      ])
    : [{ data: [] }, { data: [] }];

  return (
    <CalendarWorkspace
      workspaceId={workspace?.id || ""}
      events={events || []}
      tasks={tasks || []}
    />
  );
}
