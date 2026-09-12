import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentWorkspace } from "@/lib/workspace";
import { SettingsForm } from "./SettingsForm";

export default async function SettingsPage() {
  const workspace = await getCurrentWorkspace();
  const supabase = await createSupabaseServerClient();
  const { data } = workspace
    ? await supabase.from("integrations").select("metadata").eq("workspace_id", workspace.id).eq("provider", "workspace").maybeSingle()
    : { data: null };
  const metadata = (data?.metadata || {}) as {
    revenueTargets?: string;
    locations?: string;
    employeeRanges?: string;
    keywords?: string;
  };
  return (
    <section className="main">
      <p className="kicker">Settings</p>
      <h2>Settings</h2>
      <SettingsForm
        workspaceId={workspace?.id || ""}
        workspaceName={workspace?.name || ""}
        revenueTargets={metadata.revenueTargets || ""}
        locations={metadata.locations || ""}
        employeeRanges={metadata.employeeRanges || ""}
        keywords={metadata.keywords || ""}
      />
    </section>
  );
}
