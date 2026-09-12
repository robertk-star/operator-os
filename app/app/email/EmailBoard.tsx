"use client";

import { FormEvent, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type Contact = { id: string; full_name: string };
type Message = {
  id: string;
  provider: string;
  direction: string;
  subject: string | null;
  snippet: string | null;
  occurred_at: string;
  contact_id: string | null;
  contacts?: { full_name: string } | { full_name: string }[] | null;
};

function personName(item: Message) {
  const value = item.contacts;
  if (Array.isArray(value)) return value[0]?.full_name;
  return value?.full_name;
}

export function EmailBoard({
  workspaceId,
  initialMessages,
  contacts,
}: {
  workspaceId: string;
  initialMessages: Message[];
  contacts: Contact[];
}) {
  const [messages, setMessages] = useState(initialMessages);
  const [direction, setDirection] = useState<"in" | "out">("in");
  const [subject, setSubject] = useState("");
  const [snippet, setSnippet] = useState("");
  const [contactId, setContactId] = useState("");
  const [message, setMessage] = useState("");

  async function addMessage(event: FormEvent) {
    event.preventDefault();
    if (!workspaceId || !subject.trim()) return;
    const supabase = createSupabaseBrowserClient();
    const { data, error } = await supabase
      .from("messages")
      .insert({
        workspace_id: workspaceId,
        provider: "manual",
        direction,
        subject: subject.trim(),
        snippet: snippet.trim() || null,
        contact_id: contactId || null,
        occurred_at: new Date().toISOString(),
      })
      .select("id, provider, direction, subject, snippet, occurred_at, contact_id, contacts(full_name)")
      .single();
    if (error || !data) {
      setMessage(error?.message || "Could not save message.");
      return;
    }
    setMessages((current) => [data, ...current]);
    setSubject("");
    setSnippet("");
    setMessage("");
  }

  return (
    <div className="stack wide">
      <form className="stack" onSubmit={addMessage}>
        <label>
          Direction
          <select value={direction} onChange={(e) => setDirection(e.target.value as "in" | "out")}>
            <option value="in">Inbound</option>
            <option value="out">Outbound</option>
          </select>
        </label>
        <label>
          Contact
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
          Subject
          <input value={subject} onChange={(e) => setSubject(e.target.value)} required />
        </label>
        <label>
          Snippet
          <textarea value={snippet} onChange={(e) => setSnippet(e.target.value)} rows={4} />
        </label>
        <button type="submit">Log message</button>
      </form>
      {message ? <p>{message}</p> : null}
      <ul className="record-list">
        {messages.length === 0 ? <li>No messages yet.</li> : null}
        {messages.map((item) => (
          <li key={item.id}>
            <div>
              <strong>{item.subject}</strong>
              <div className="meta">
                {[item.direction === "in" ? "Inbound" : "Outbound", personName(item) || "Unassigned", new Date(item.occurred_at).toLocaleString()].join(" · ")}
              </div>
              {item.snippet ? <p>{item.snippet}</p> : null}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
