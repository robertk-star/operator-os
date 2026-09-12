"use client";

import { FormEvent, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type Contact = { id: string; full_name: string };
type EventRow = {
  id: string;
  kind: string;
  summary: string;
  happened_at: string;
  contact_id: string | null;
  contacts?: { full_name: string } | { full_name: string }[] | null;
};

function contactName(event: EventRow) {
  const value = event.contacts;
  if (Array.isArray(value)) return value[0]?.full_name;
  return value?.full_name;
}

export function RelationshipList({
  workspaceId,
  initialEvents,
  contacts,
  selectedContactId,
}: {
  workspaceId: string;
  initialEvents: EventRow[];
  contacts: Contact[];
  selectedContactId: string;
}) {
  const [events, setEvents] = useState(initialEvents);
  const [contactId, setContactId] = useState(selectedContactId);
  const [kind, setKind] = useState("call");
  const [summary, setSummary] = useState("");
  const [happenedAt, setHappenedAt] = useState("");
  const [message, setMessage] = useState("");

  async function addEvent(event: FormEvent) {
    event.preventDefault();
    if (!workspaceId || !summary.trim()) return;
    const supabase = createSupabaseBrowserClient();
    const { data, error } = await supabase
      .from("relationship_events")
      .insert({
        workspace_id: workspaceId,
        contact_id: contactId || null,
        kind,
        summary: summary.trim(),
        happened_at: happenedAt ? new Date(happenedAt).toISOString() : new Date().toISOString(),
      })
      .select("id, kind, summary, happened_at, contact_id, contacts(full_name)")
      .single();
    if (error || !data) {
      setMessage(error?.message || "Could not save interaction.");
      return;
    }
    setEvents((current) => [data, ...current]);
    setSummary("");
    setMessage("");
  }

  return (
    <div className="stack wide">
      <form className="stack" onSubmit={addEvent}>
        <label>
          Person
          <select value={contactId} onChange={(e) => setContactId(e.target.value)}>
            <option value="">Unassigned</option>
            {contacts.map((contact) => (
              <option key={contact.id} value={contact.id}>
                {contact.full_name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Kind
          <select value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="call">Call</option>
            <option value="email">Email</option>
            <option value="meeting">Meeting</option>
            <option value="note">Note</option>
            <option value="other">Other</option>
          </select>
        </label>
        <label>
          What happened
          <textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows={4} required />
        </label>
        <label>
          When (optional)
          <input type="datetime-local" value={happenedAt} onChange={(e) => setHappenedAt(e.target.value)} />
        </label>
        <button type="submit">Log interaction</button>
      </form>
      {message ? <p>{message}</p> : null}
      {contacts.length === 0 ? <p>Add a contact first so interactions can attach to a person.</p> : null}
      <ul className="record-list">
        {events.length === 0 ? <li>No interactions yet.</li> : null}
        {events.map((item) => (
          <li key={item.id}>
            <div>
              <strong>{item.kind}</strong>
              <div className="meta">
                {[contactName(item) || "Unassigned", new Date(item.happened_at).toLocaleString()].join(" · ")}
              </div>
              <p>{item.summary}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
