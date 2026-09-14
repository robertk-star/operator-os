import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentWorkspace } from "@/lib/workspace";
import { TasksDesk } from "./TasksDesk";

export default async function TasksPage() {
  const workspace = await getCurrentWorkspace();
  const supabase = await createSupabaseServerClient();
  const [{ data: tasks }, { data: members }] = workspace
    ? await Promise.all([
        supabase.from("tasks").select("id, title, status, due_at, notes, owner_id, created_at, updated_at").eq("workspace_id", workspace.id).order("created_at", { ascending: false }),
        supabase.from("workspace_members").select("user_id, role").eq("workspace_id", workspace.id),
      ])
    : [{ data: [] }, { data: [] }];

  return (
    <section className="main contacts-main">
      <TasksDesk workspaceId={workspace?.id || ""} initialTasks={tasks || []} members={members || []} />
    </section>
  );
}
