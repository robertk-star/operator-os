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

  const { data: membership } = await supabase
    .from("workspace_members")
    .select("role, workspace_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!membership?.workspace_id) return null;

  const { data: workspace } = await supabase.from("workspaces").select("id, name, mode").eq("id", membership.workspace_id).maybeSingle();
  if (!workspace) return null;

  return {
    id: workspace.id,
    name: workspace.name,
    mode: workspace.mode || "solo",
    role: membership.role || "owner",
  };
}
