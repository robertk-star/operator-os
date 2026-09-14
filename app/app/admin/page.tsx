import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentWorkspace } from "@/lib/workspace";
import { AdminPanel } from "./AdminPanel";
import { SmartleadAdmin } from "./SmartleadAdmin";

export default async function AdminPage() {
  const workspace = await getCurrentWorkspace();
  const supabase = await createSupabaseServerClient();
  const [{ data: members }, { data: invites }] = workspace
    ? await Promise.all([
        supabase.from("workspace_members").select("id, role, user_id, created_at").eq("workspace_id", workspace.id),
        supabase
          .from("workspace_invites")
          .select("id, email, role, accepted_at, created_at")
          .eq("workspace_id", workspace.id)
          .order("created_at", { ascending: false }),
      ])
    : [{ data: [] }, { data: [] }];

  return (
    <section className="main">
      <p className="kicker">Admin</p>
      <h2>Admin</h2>
      <p className="meta">
        {workspace?.name} · {workspace?.mode} · your role {workspace?.role}
      </p>
      <SmartleadAdmin />
      <AdminPanel
        workspaceId={workspace?.id || ""}
        canInvite={workspace?.mode === "team" && (workspace?.role === "owner" || workspace?.role === "admin")}
        members={members || []}
        invites={invites || []}
      />
    </section>
  );
}
