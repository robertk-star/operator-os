"use client";

import { useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type Person = {
  id: string;
  full_name: string;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  phone?: string | null;
  business_name?: string | null;
  job_title?: string | null;
  industry?: string | null;
  website?: string | null;
  linkedin_url?: string | null;
  street_address?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  country?: string | null;
  source?: string | null;
  status?: string | null;
  organizations?: { name?: string; domain?: string } | { name?: string; domain?: string }[] | null;
};

function companyName(person: Person) {
  const value = person.organizations;
  if (Array.isArray(value)) return value[0]?.name || person.business_name || "";
  return value?.name || person.business_name || "";
}
function displayName(person: Person) {
  return [person.first_name, person.last_name].filter(Boolean).join(" ") || person.full_name || "Untitled";
}

export function PeopleDesk({ workspaceId, initialContacts }: { workspaceId: string; initialContacts: Person[] }) {
  const [people, setPeople] = useState(initialContacts);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(initialContacts[0]?.id || "");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const selected = people.find((item) => item.id === selectedId) || null;

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return people.filter((item) => {
      if ((item.status || "active") === "archived") return false;
      if (!term) return true;
      return [displayName(item), companyName(item), item.email, item.job_title].join(" ").toLowerCase().includes(term);
    });
  }, [people, query]);

  async function save(patch: Partial<Person>) {
    if (!selected) return;
    const supabase = createSupabaseBrowserClient();
    const fullName =
      [patch.first_name ?? selected.first_name, patch.last_name ?? selected.last_name].filter(Boolean).join(" ") ||
      selected.full_name;
    const { error } = await supabase.from("contacts").update({ ...patch, full_name: fullName }).eq("id", selected.id);
    if (error) {
      setMessage(error.message);
      return;
    }
    setPeople((current) => current.map((item) => (item.id === selected.id ? { ...item, ...patch, full_name: fullName } : item)));
    setMessage("Saved.");
  }

  async function reveal() {
    if (!selected) return;
    setBusy(true);
    const response = await fetch("/api/revenue/reveal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contactId: selected.id }),
    });
    const payload = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) {
      setMessage(payload.error || "Reveal failed.");
      return;
    }
    if (payload.email) {
      setPeople((current) => current.map((item) => (item.id === selected.id ? { ...item, email: payload.email } : item)));
    }
    setMessage(payload.note || (payload.email ? "Email saved." : "No email found."));
  }

  async function remove() {
    if (!selected) return;
    if (!window.confirm(`Delete ${displayName(selected)}?`)) return;
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.from("contacts").delete().eq("id", selected.id);
    if (error) {
      setMessage(error.message);
      return;
    }
    const remaining = people.filter((item) => item.id !== selected.id);
    setPeople(remaining);
    setSelectedId(remaining[0]?.id || "");
  }

  return (
    <div className="contacts-desk">
      <div className="contacts-top">
        <div>
          <h2>
            Contacts <span className="badge">People</span>
          </h2>
          <p className="meta">Name, title, email, and the company they belong to. Drip selection comes next.</p>
        </div>
      </div>
      <div className="contacts-split">
        <aside className="contacts-list">
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, company, email..." />
          <p className="meta">Showing {filtered.length}</p>
          {filtered.map((item) => (
            <button key={item.id} type="button" className={item.id === selectedId ? "contact-row selected" : "contact-row"} onClick={() => setSelectedId(item.id)}>
              <strong>{displayName(item)}</strong>
              <span>{companyName(item)}</span>
              <small>{item.email || item.job_title || ""}</small>
            </button>
          ))}
        </aside>
        <div className="contact-record card">
          {selected ? (
            <>
              <p className="kicker">Contact record</p>
              <h3>{displayName(selected)}</h3>
              <p className="meta">{companyName(selected)}</p>
              {selected.website ? (
                <p>
                  <a href={selected.website.startsWith("http") ? selected.website : `https://${selected.website}`} target="_blank" rel="noreferrer">
                    {selected.website}
                  </a>
                </p>
              ) : null}
              <div className="row">
                <button type="button" disabled={busy} onClick={() => void reveal()} style={{ background: "#17243f", color: "#fff", border: 0 }}>
                  {busy ? "Revealing..." : "Reveal email"}
                </button>
                <button type="button" className="chip" onClick={() => void remove()}>Delete</button>
              </div>
              <div className="form-grid">
                <label>First name<input value={selected.first_name || ""} onChange={(e) => save({ first_name: e.target.value })} /></label>
                <label>Last name<input value={selected.last_name || ""} onChange={(e) => save({ last_name: e.target.value })} /></label>
                <label>Job title<input value={selected.job_title || ""} onChange={(e) => save({ job_title: e.target.value })} /></label>
                <label>Email<input value={selected.email || ""} onChange={(e) => save({ email: e.target.value })} /></label>
                <label>Phone<input value={selected.phone || ""} onChange={(e) => save({ phone: e.target.value })} /></label>
                <label>LinkedIn<input value={selected.linkedin_url || ""} onChange={(e) => save({ linkedin_url: e.target.value })} /></label>
                <label>Company<input value={selected.business_name || companyName(selected)} onChange={(e) => save({ business_name: e.target.value })} /></label>
                <label>Industry<input value={selected.industry || ""} onChange={(e) => save({ industry: e.target.value })} /></label>
                <label>Website<input value={selected.website || ""} onChange={(e) => save({ website: e.target.value })} /></label>
              </div>
              <div className="form-grid">
                <label>Street address<input value={selected.street_address || ""} onChange={(e) => save({ street_address: e.target.value })} /></label>
                <label>City<input value={selected.city || ""} onChange={(e) => save({ city: e.target.value })} /></label>
                <label>State<input value={selected.state || ""} onChange={(e) => save({ state: e.target.value })} /></label>
                <label>Postal code<input value={selected.postal_code || ""} onChange={(e) => save({ postal_code: e.target.value })} /></label>
                <label>Country<input value={selected.country || ""} onChange={(e) => save({ country: e.target.value })} /></label>
              </div>
              {message ? <p className="meta">{message}</p> : null}
            </>
          ) : (
            <p>No contact selected.</p>
          )}
        </div>
      </div>
    </div>
  );
}
