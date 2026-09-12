"use client";

import { FormEvent, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type Item = { id: string; title: string; body: string; updated_at: string };

export function ProcedureList({ workspaceId, initialItems }: { workspaceId: string; initialItems: Item[] }) {
  const [items, setItems] = useState(initialItems);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [message, setMessage] = useState("");

  async function add(event: FormEvent) {
    event.preventDefault();
    const supabase = createSupabaseBrowserClient();
    const { data, error } = await supabase
      .from("procedures")
      .insert({ workspace_id: workspaceId, title: title.trim(), body: body.trim() })
      .select("id, title, body, updated_at")
      .single();
    if (error || !data) {
      setMessage(error?.message || "Could not save procedure. Run the latest SQL migration if this table is missing.");
      return;
    }
    setItems((current) => [...current, data]);
    setTitle("");
    setBody("");
    setMessage("");
  }

  return (
    <div className="stack">
      <form className="stack" onSubmit={add}>
        <label>
          Title
          <input value={title} onChange={(e) => setTitle(e.target.value)} required />
        </label>
        <label>
          Body
          <textarea className="field" value={body} onChange={(e) => setBody(e.target.value)} rows={6} />
        </label>
        <button type="submit">Save procedure</button>
      </form>
      {message ? <p>{message}</p> : null}
      <ul className="record-list">
        {items.length === 0 ? <li>No procedures yet.</li> : null}
        {items.map((item) => (
          <li key={item.id}>
            <div>
              <strong>{item.title}</strong>
              <p>{item.body}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
