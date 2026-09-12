"use client";

import { FormEvent, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type Item = { id: string; title: string; rank: number; status: string };

export function PriorityList({ workspaceId, initialItems }: { workspaceId: string; initialItems: Item[] }) {
  const [items, setItems] = useState(initialItems);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");

  async function add(event: FormEvent) {
    event.preventDefault();
    const supabase = createSupabaseBrowserClient();
    const { data, error } = await supabase
      .from("priorities")
      .insert({ workspace_id: workspaceId, title: title.trim(), rank: items.length + 1 })
      .select("id, title, rank, status")
      .single();
    if (error || !data) {
      setMessage(error?.message || "Could not save priority. Run the latest SQL migration if this table is missing.");
      return;
    }
    setItems((current) => [...current, data]);
    setTitle("");
    setMessage("");
  }

  return (
    <div className="stack">
      <form className="stack" onSubmit={add}>
        <label>
          Priority
          <input value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="Close the open proposal" />
        </label>
        <button type="submit">Add priority</button>
      </form>
      {message ? <p>{message}</p> : null}
      <ul className="record-list">
        {items.length === 0 ? <li>No priorities yet.</li> : null}
        {items.map((item, index) => (
          <li key={item.id}>
            <div>
              <strong>
                {index + 1}. {item.title}
              </strong>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
