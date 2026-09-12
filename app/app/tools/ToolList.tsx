"use client";

import { FormEvent, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type Item = { id: string; name: string; url: string | null; notes: string | null };

export function ToolList({ workspaceId, initialItems }: { workspaceId: string; initialItems: Item[] }) {
  const [items, setItems] = useState(initialItems);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState("");

  async function add(event: FormEvent) {
    event.preventDefault();
    const supabase = createSupabaseBrowserClient();
    const { data, error } = await supabase
      .from("tools")
      .insert({ workspace_id: workspaceId, name: name.trim(), url: url.trim() || null, notes: notes.trim() || null })
      .select("id, name, url, notes")
      .single();
    if (error || !data) {
      setMessage(error?.message || "Could not save tool. Run the latest SQL migration if this table is missing.");
      return;
    }
    setItems((current) => [...current, data]);
    setName("");
    setUrl("");
    setNotes("");
    setMessage("");
  }

  return (
    <div className="stack">
      <form className="stack" onSubmit={add}>
        <label>
          Name
          <input value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <label>
          URL
          <input value={url} onChange={(e) => setUrl(e.target.value)} />
        </label>
        <label>
          Notes
          <input value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>
        <button type="submit">Add tool</button>
      </form>
      {message ? <p>{message}</p> : null}
      <ul className="record-list">
        {items.length === 0 ? <li>No tools yet.</li> : null}
        {items.map((item) => (
          <li key={item.id}>
            <div>
              <strong>{item.name}</strong>
              <div className="meta">{item.url || item.notes || "No details"}</div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
