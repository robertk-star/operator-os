import { AppNav } from "@/components/AppNav";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentWorkspace } from "@/lib/workspace";
import { EmailBoard } from "./EmailBoard";

export default async function EmailPage() {
  const workspace = await getCurrentWorkspace();
  const supabase = await createSupabaseServerClient();

  const [{ data: messages }, { data: contacts }] = workspace
    ? await Promise.all([
        supabase
          .from("messages")
          .select("id, provider, direction, subject, snippet, occurred_at, contact_id, contacts(full_name)")
          .eq("workspace_id", workspace.id)
          .order("occurred_at", { ascending: false }),
        supabase.from("contacts").select("id, full_name").eq("workspace_id", workspace.id).order("full_name"),
      ])
    : [{ data: [] }, { data: [] }];

  return (
    <main className="wrap">
      <AppNav current="/app/email" />
      <p className="kicker">{workspace?.name}</p>
      <h1>Email</h1>
      <p className="meta">Log mail against the workspace now. Gmail inbox sync needs Google OAuth next.</p>
      <EmailBoard workspaceId={workspace?.id || ""} initialMessages={messages || []} contacts={contacts || []} />
    </main>
  );
}
