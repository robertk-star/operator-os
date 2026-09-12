import { AppNav } from "@/components/AppNav";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentWorkspace } from "@/lib/workspace";
import { TaskList } from "./TaskList";

export default async function TasksPage() {
  const workspace = await getCurrentWorkspace();
  const supabase = await createSupabaseServerClient();
  const { data: tasks } = workspace
    ? await supabase
        .from("tasks")
        .select("id, title, status, due_at, notes, created_at")
        .eq("workspace_id", workspace.id)
        .order("created_at", { ascending: false })
    : { data: [] };

  return (
    <main className="wrap">
      <AppNav current="/app/tasks" />
      <p className="kicker">{workspace?.name}</p>
      <h1>Tasks</h1>
      <TaskList workspaceId={workspace?.id || ""} initialTasks={tasks || []} />
    </main>
  );
}
