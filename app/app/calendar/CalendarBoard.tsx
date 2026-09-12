"use client";

import { FormEvent, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type CalEvent = {
  id: string;
  title: string;
  starts_at: string;
  ends_at: string | null;
};

export function CalendarBoard({
  workspaceId,
  initialEvents,
}: {
  workspaceId: string;
  initialEvents: CalEvent[];
}) {
  const [events, setEvents] = useState(initialEvents);
  const [title, setTitle] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [message, setMessage] = useState("");

  async function addEvent(event: FormEvent) {
    event.preventDefault();
    if (!workspaceId || !title.trim() || !startsAt) return;
    const supabase = createSupabaseBrowserClient();
    const { data, error } = await supabase
      .from("calendar_events")
      .insert({
        workspace_id: workspaceId,
        title: title.trim(),
        starts_at: new Date(startsAt).toISOString(),
        ends_at: endsAt ? new Date(endsAt).toISOString() : null,
      })
      .select("id, title, starts_at, ends_at")
      .single();
    if (error || !data) {
      setMessage(error?.message || "Could not save event.");
      return;
    }
    setEvents((current) => [...current, data].sort((a, b) => a.starts_at.localeCompare(b.starts_at)));
    setTitle("");
    setStartsAt("");
    setEndsAt("");
    setMessage("");
  }

  return (
    <div className="stack wide">
      <form className="stack" onSubmit={addEvent}>
        <label>
          Event
          <input value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="Client call" />
        </label>
        <label>
          Starts
          <input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} required />
        </label>
        <label>
          Ends
          <input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
        </label>
        <button type="submit">Add event</button>
      </form>
      {message ? <p>{message}</p> : null}
      <ul className="record-list">
        {events.length === 0 ? <li>No events yet.</li> : null}
        {events.map((item) => (
          <li key={item.id}>
            <div>
              <strong>{item.title}</strong>
              <div className="meta">
                {new Date(item.starts_at).toLocaleString()}
                {item.ends_at ? ` – ${new Date(item.ends_at).toLocaleString()}` : ""}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
