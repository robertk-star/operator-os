"use client";

import { FormEvent, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type Sequence = { id: string; name: string; audience: string | null; status: string };
type Contact = { id: string; full_name: string; email: string | null };
type Enrollment = {
  id: string;
  sequence_id: string;
  contact_id: string;
  status: string;
  contacts?: { full_name: string; email: string | null } | { full_name: string; email: string | null }[] | null;
};

function contactLabel(row: Enrollment) {
  const value = row.contacts;
  const person = Array.isArray(value) ? value[0] : value;
  return person ? `${person.full_name}${person.email ? ` · ${person.email}` : ""}` : row.contact_id;
}

export function SequenceBoard({
  workspaceId,
  initialSequences,
  contacts,
  enrollments,
}: {
  workspaceId: string;
  initialSequences: Sequence[];
  contacts: Contact[];
  enrollments: Enrollment[];
}) {
  const [items, setItems] = useState(initialSequences);
  const [queued, setQueued] = useState(enrollments);
  const [name, setName] = useState("");
  const [audience, setAudience] = useState("");
  const [sequenceId, setSequenceId] = useState(initialSequences[0]?.id || "");
  const [contactId, setContactId] = useState("");
  const [message, setMessage] = useState("");

  async function addSequence(event: FormEvent) {
    event.preventDefault();
    const supabase = createSupabaseBrowserClient();
    const { data, error } = await supabase
      .from("outbound_sequences")
      .insert({ workspace_id: workspaceId, name: name.trim(), audience: audience.trim() || null, status: "draft" })
      .select("id, name, audience, status")
      .single();
    if (error || !data) {
      setMessage(error?.message || "Could not save sequence. Run the latest SQL if tables are missing.");
      return;
    }
    setItems((current) => [data, ...current]);
    setSequenceId(data.id);
    setName("");
    setAudience("");
    setMessage("");
  }

  async function enroll(event: FormEvent) {
    event.preventDefault();
    if (!sequenceId || !contactId) return;
    const supabase = createSupabaseBrowserClient();
    const { data, error } = await supabase
      .from("sequence_enrollments")
      .insert({ workspace_id: workspaceId, sequence_id: sequenceId, contact_id: contactId, status: "queued" })
      .select("id, sequence_id, contact_id, status, contacts(full_name, email)")
      .single();
    if (error || !data) {
      setMessage(error?.message || "Could not enroll contact. Run the enrollments SQL.");
      return;
    }
    setQueued((current) => [data, ...current]);
    setMessage("Contact queued. No email is sent from sequences yet.");
  }

  return (
    <div className="stack wide">
      <form className="stack" onSubmit={addSequence}>
        <label>
          Sequence name
          <input value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <label>
          Audience
          <input value={audience} onChange={(e) => setAudience(e.target.value)} placeholder="Uses Settings targets if blank" />
        </label>
        <button type="submit">Create sequence</button>
      </form>
      <form className="stack" onSubmit={enroll}>
        <label>
          Sequence
          <select value={sequenceId} onChange={(e) => setSequenceId(e.target.value)}>
            <option value="">Choose sequence</option>
            {items.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Contact
          <select value={contactId} onChange={(e) => setContactId(e.target.value)}>
            <option value="">Choose contact</option>
            {contacts.map((contact) => (
              <option key={contact.id} value={contact.id}>
                {contact.full_name}
              </option>
            ))}
          </select>
        </label>
        <button type="submit">Enqueue contact</button>
      </form>
      {message ? <p>{message}</p> : null}
      <ul className="record-list">
        {items.length === 0 ? <li>No sequences yet.</li> : null}
        {items.map((item) => (
          <li key={item.id}>
            <div>
              <strong>{item.name}</strong>
              <div className="meta">
                {item.status} {item.audience ? `· ${item.audience}` : ""} ·{" "}
                {queued.filter((row) => row.sequence_id === item.id).length} queued
              </div>
              <ul>
                {queued
                  .filter((row) => row.sequence_id === item.id)
                  .map((row) => (
                    <li key={row.id}>{contactLabel(row)}</li>
                  ))}
              </ul>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
