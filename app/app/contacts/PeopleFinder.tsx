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
    if (!reviewed) {
      setMessage("Turn Reviewed on first.");
      return;
    }
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
    setSelected(Object.fromEntries(next.map((item, index) => [keyFor(item, index), false])));
    setMessage(next.length ? `Found ${next.length} names. Reveal email only for people you want.` : "No people matched those titles.");
  }

  async function revealSelected() {
    const chosen = items.filter((item, index) => selected[keyFor(item, index)] && !item.email);
    if (!chosen.length) {
      setMessage("Select people with no email first.");
      return;
    }
    setBusy(true);
    let found = 0;
    const next = [...items];
    for (const person of chosen) {
      const response = await fetch("/api/revenue/reveal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          personId: person.id,
          first_name: person.first_name,
          last_name: person.last_name,
          website,
          company: companyName,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (payload.person?.email || payload.email) {
        found += 1;
        const index = next.findIndex((item) => item.id === person.id || item.full_name === person.full_name);
        if (index >= 0) next[index] = { ...next[index], email: payload.email || payload.person.email };
      }
    }
    setItems(next);
    setBusy(false);
    setMessage(`Revealed ${found} of ${chosen.length}. About 1 credit each when Apollo returns an email.`);
  }

  async function saveSelected() {
    const chosen = items.filter((item, index) => selected[keyFor(item, index)]);
    if (!chosen.length) return;
    setBusy(true);
    const supabase = createSupabaseBrowserClient();
    let saved = 0;
    for (const person of chosen) {
      const row: Record<string, unknown> = {
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
      };
      if (person.id) row.apollo_person_id = person.id;
      const { error } = await supabase.from("contacts").insert(row);
      if (!error) saved += 1;
    }
    setBusy(false);
    setMessage(`Saved ${saved} people to Contacts.`);
  }

  return (
    <div className="stack">
      <button type="button" disabled={busy} onClick={() => void findPeople()} style={{ background: "#17243f", color: "#fff", border: 0, width: "100%" }}>
        {busy ? "Working..." : "Find people"}
      </button>
      {!reviewed ? <p className="meta">Turn Reviewed on to run Find people.</p> : null}
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
            <button type="button" disabled={busy} onClick={() => void revealSelected()}>
              Reveal email for selected
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
                  <div className="meta">{[item.title, item.email || "No email yet"].filter(Boolean).join(" · ")}</div>
                </label>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}
