"use client";

import { FormEvent, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type Item = { id: string; name: string; audience: string | null; status: string };

export function SequenceList({ workspaceId, initialItems }: { workspaceId: string; initialItems: Item[] }) {
  const [items, setItems] = useState(initialItems);
  const [name, setName] = useState("");
  const [audience, setAudience] = useState("");
  const [message, setMessage] = useState("");

  async function add(event: FormEvent) {
    event.preventDefault();
    const supabase = createSupabaseBrowserClient();
    const { data, error } = await supabase
      .from("outbound_sequences")
      .insert({ workspace_id: workspaceId, name: name.trim(), audience: audience.trim() || null, status: "draft" })
      .select("id, name, audience, status")
      .single();
    if (error || !data) {
      setMessage(error?.message || "Could not save sequence. Run the latest SQL migration if this table is missing.");
      return;
    }
    setItems((current) => [data, ...current]);
    setName("");
    setAudience("");
    setMessage("");
  }

  return (
    <div className="stack">
      <form className="stack" onSubmit={add}>
        <label>
          Sequence name
          <input value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <label>
          Audience
          <input value={audience} onChange={(e) => setAudience(e.target.value)} placeholder="Uses Settings target types if left blank" />
        </label>
        <button type="submit">Create draft sequence</button>
      </form>
      {message ? <p>{message}</p> : null}
      <ul className="record-list">
        {items.length === 0 ? <li>No sequences yet.</li> : null}
        {items.map((item) => (
          <li key={item.id}>
            <div>
              <strong>{item.name}</strong>
              <div className="meta">
                {item.status} {item.audience ? `· ${item.audience}` : ""}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
