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
    <section className="main">
      <p className="kicker">Calendar</p>
      <h2>Calendar</h2>
      <p className="meta">Workspace calendar. Google Calendar sync uses the same OAuth connection as Gmail, when that is added.</p>
      <CalendarBoard workspaceId={workspace?.id || ""} initialEvents={events || []} />
    </section>
  );
}
