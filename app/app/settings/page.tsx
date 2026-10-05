import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentWorkspace } from "@/lib/workspace";
import { ApolloProfile, SettingsForm } from "./SettingsForm";

function profilesFrom(metadata: Record<string, unknown>): ApolloProfile[] {
  const stored = metadata.apolloProfiles;
  if (Array.isArray(stored) && stored.length) return stored as ApolloProfile[];
  if (!metadata.locations && !metadata.keywords && !metadata.industries && !metadata.employeeRanges) return [];
  return [
    {
      id: "default",
      name: "Default search",
      revenueTargets: String(metadata.revenueTargets || ""),
      locations: String(metadata.locations || "United States"),
      employeeRanges: String(metadata.employeeRanges || "1001,5000; 5001,10000; 10001+"),
      keywords: String(metadata.keywords || ""),
      industries: String(metadata.industries || ""),
      excludeKeywords: String(metadata.excludeKeywords || "staffing, recruiting, recruiter, talent agency, employment agency"),
      excludeIndustries: String(metadata.excludeIndustries || "Staffing & Recruiting"),
    },
  ];
}

export default async function SettingsPage() {
  const workspace = await getCurrentWorkspace();
  const supabase = await createSupabaseServerClient();
  const { data } = workspace
    ? await supabase.from("integrations").select("metadata").eq("workspace_id", workspace.id).eq("provider", "workspace").maybeSingle()
    : { data: null };
  const profiles = profilesFrom((data?.metadata || {}) as Record<string, unknown>);
  return (
    <section className="main">
      <p className="kicker">Settings</p>
      <h2>Apollo Leads Settings</h2>
      <p className="meta">Create a search profile for each kind of company you want. Revenue Engine lets you pick one before Find companies.</p>
      <SettingsForm workspaceId={workspace?.id || ""} workspaceName={workspace?.name || ""} profiles={profiles} />
    </section>
  );
}
