import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentWorkspace } from "@/lib/workspace";
import { NoteList } from "./NoteList";

export default async function NotesPage() {
  const workspace = await getCurrentWorkspace();
  const supabase = await createSupabaseServerClient();
  const { data: notes } = workspace
    ? await supabase
        .from("notes")
        .select("id, title, body, updated_at")
        .eq("workspace_id", workspace.id)
        .order("updated_at", { ascending: false })
    : { data: [] };

  return (
    <section className="main">
      <p className="kicker">My Notes</p>
      <h2>My Notes</h2>
      <NoteList workspaceId={workspace?.id || ""} initialNotes={notes || []} />
    </section>
  );
}
