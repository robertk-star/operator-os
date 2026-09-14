import { createSupabaseServerClient } from "./supabase/server";

export type WorkspaceSummary = {
  id: string;
  name: string;
  mode: string;
  role: string;
};

export async function getCurrentWorkspace(): Promise<WorkspaceSummary | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("workspace_members")
    .select("role, workspace_id, workspaces(id, name, mode)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!data) return null;
  const ws = Array.isArray(data.workspaces) ? data.workspaces[0] : data.workspaces;
  if (!ws) return null;
  return { id: ws.id, name: ws.name, mode: ws.mode || "personal", role: data.role || "owner" };
}
