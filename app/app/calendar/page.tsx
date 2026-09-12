import { AppNav } from "@/components/AppNav";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentWorkspace } from "@/lib/workspace";
import { CalendarBoard } from "./CalendarBoard";

export default async function CalendarPage() {
  const workspace = await getCurrentWorkspace();
  const supabase = await createSupabaseServerClient();
  const { data: events } = workspace
    ? await supabase
        .from("calendar_events")
        .select("id, title, starts_at, ends_at")
        .eq("workspace_id", workspace.id)
        .order("starts_at", { ascending: true })
    : { data: [] };

  return (
    <main className="wrap">
      <AppNav current="/app/calendar" />
      <p className="kicker">{workspace?.name}</p>
      <h1>Calendar</h1>
      <p className="meta">Workspace calendar. Google Calendar sync comes after OAuth keys are added.</p>
      <CalendarBoard workspaceId={workspace?.id || ""} initialEvents={events || []} />
    </main>
  );
}
