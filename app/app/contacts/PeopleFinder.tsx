"use client";

import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type Person = {
  id?: string;
  first_name?: string;
  last_name?: string;
  full_name: string;
  title?: string;
  email?: string;
  email_status?: string;
  linkedin_url?: string;
};

export function PeopleFinder({
  workspaceId,
  companyId,
  companyName,
  organizationId,
  website,
  reviewed,
}: {
  workspaceId: string;
  companyId: string;
  companyName: string;
  organizationId?: string | null;
  website?: string | null;
  reviewed: boolean;
}) {
  const [items, setItems] = useState<Person[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  function keyFor(person: Person, index: number) {
    return person.id || `${person.full_name}-${index}`;
  }

  async function findPeople() {
    setBusy(true);
    setMessage("");
    const response = await fetch(`/api/revenue/people?contactId=${companyId}`);
    const payload = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) {
      setMessage(payload.error || "Could not find people.");
      return;
    }
    const next: Person[] = payload.items || [];
    setItems(next);
    setSelected(Object.fromEntries(next.map((item, index) => [keyFor(item, index), true])));
    setMessage(next.length ? `Found ${next.length}. This used 1 Apollo credit.` : "No people matched those titles.");
  }

  async function saveSelected() {
    const chosen = items.filter((item, index) => selected[keyFor(item, index)]);
    if (!chosen.length) return;
    setBusy(true);
    const supabase = createSupabaseBrowserClient();
    let saved = 0;
    for (const person of chosen) {
      const { error } = await supabase.from("contacts").insert({
        workspace_id: workspaceId,
        organization_id: organizationId || null,
        record_type: "person",
        full_name: person.full_name,
        first_name: person.first_name || "",
        last_name: person.last_name || "",
        job_title: person.title || "",
        email: person.email || null,
        email_status: person.email ? "review_required" : "missing",
        linkedin_url: person.linkedin_url || "",
        business_name: companyName,
        website: website || "",
        source: "apollo",
        status: "active",
        reviewed: false,
      });
      if (!error) saved += 1;
    }
    setBusy(false);
    setMessage(`Saved ${saved} people to Contacts.`);
  }

  if (!reviewed) return <p className="meta">Mark Reviewed to find people at this company.</p>;

  return (
    <div className="stack">
      <button type="button" disabled={busy} onClick={() => void findPeople()} style={{ background: "#17243f", color: "#fff", border: 0 }}>
        {busy ? "Searching Apollo..." : "Find people and emails"}
      </button>
      {message ? <p className="meta">{message}</p> : null}
      {items.length ? (
        <>
          <div className="row">
            <button type="button" className="chip" onClick={() => setSelected(Object.fromEntries(items.map((item, index) => [keyFor(item, index), true])))}>
              Select all
            </button>
            <button type="button" className="chip" onClick={() => setSelected({})}>
              Select none
            </button>
            <button type="button" disabled={busy} onClick={() => void saveSelected()}>
              Save selected to Contacts
            </button>
          </div>
          <ul className="record-list">
            {items.map((item, index) => (
              <li key={keyFor(item, index)}>
                <label>
                  <input
                    type="checkbox"
                    checked={Boolean(selected[keyFor(item, index)])}
                    onChange={(event) => setSelected((current) => ({ ...current, [keyFor(item, index)]: event.target.checked }))}
                  />
                  <strong>{item.full_name}</strong>
                  <div className="meta">{[item.title, item.email || "No email in search result"].filter(Boolean).join(" · ")}</div>
                </label>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}
