"use client";

import { FormEvent, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type Note = {
  id: string;
  title: string;
  body: string;
  updated_at: string;
};

export function NoteList({
  workspaceId,
  initialNotes,
}: {
  workspaceId: string;
  initialNotes: Note[];
}) {
  const [notes, setNotes] = useState(initialNotes);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [message, setMessage] = useState("");

  async function addNote(event: FormEvent) {
    event.preventDefault();
    if (!workspaceId || !title.trim()) return;
    const supabase = createSupabaseBrowserClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from("notes")
      .insert({
        workspace_id: workspaceId,
        author_id: user?.id ?? null,
        title: title.trim(),
        body: body.trim(),
      })
      .select("id, title, body, updated_at")
      .single();
    if (error || !data) {
      setMessage(error?.message || "Could not save note.");
      return;
    }
    setNotes((current) => [data, ...current]);
    setTitle("");
    setBody("");
    setMessage("");
  }

  return (
    <div className="stack wide">
      <form className="stack" onSubmit={addNote}>
        <label>
          Title
          <input value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="Meeting notes" />
        </label>
        <label>
          Body
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={6} />
        </label>
        <button type="submit">Save note</button>
      </form>
      {message ? <p>{message}</p> : null}
      <ul className="record-list">
        {notes.length === 0 ? <li>No notes yet.</li> : null}
        {notes.map((note) => (
          <li key={note.id}>
            <div>
              <strong>{note.title}</strong>
              <div className="meta">{new Date(note.updated_at).toLocaleString()}</div>
              <p>{note.body}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
