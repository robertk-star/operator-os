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
    <section className="main">
      <p className="kicker">Tasks</p>
      <h2>Tasks</h2>
      <TaskList workspaceId={workspace?.id || ""} initialTasks={tasks || []} />
    </section>
  );
}
