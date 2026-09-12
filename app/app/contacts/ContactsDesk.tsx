"use client";

import { useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { ResearchButton } from "./ResearchButton";

type Contact = {
  id: string;
  full_name: string;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  phone?: string | null;
  business_name?: string | null;
  job_title?: string | null;
  industry?: string | null;
  tags?: string[] | null;
  source?: string | null;
  email_status?: string | null;
  street_address?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  country?: string | null;
  website?: string | null;
  linkedin_url?: string | null;
  status?: string | null;
  do_not_disturb?: boolean | null;
  research_notes?: string | null;
  researched_at?: string | null;
  organization_id?: string | null;
  organizations?: { name?: string; domain?: string } | { name?: string; domain?: string }[] | null;
};

const PAGE_SIZE = 50;
const EMAIL_STATUSES = ["unknown", "review_required", "valid", "invalid", "do_not_contact", "missing"];

function orgName(contact: Contact) {
  const value = contact.organizations;
  if (Array.isArray(value)) return value[0]?.name || "";
  return value?.name || contact.business_name || "";
}
function displayName(contact: Contact) {
  return [contact.first_name, contact.last_name].filter(Boolean).join(" ") || contact.full_name || orgName(contact) || "Untitled";
}
function host(value?: string | null) {
  if (!value) return "";
  try {
    return new URL(value.startsWith("http") ? value : `https://${value}`).hostname.replace(/^www\./, "");
  } catch {
    return value;
  }
}

export function ContactsDesk({ workspaceId, initialContacts }: { workspaceId: string; initialContacts: Contact[] }) {
  const [contacts, setContacts] = useState(initialContacts);
  const [query, setQuery] = useState("");
  const [summary, setSummary] = useState<"active" | "archived" | "suppressed" | "missingEmail">("active");
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState(initialContacts[0]?.id || "");
  const [message, setMessage] = useState("");

  const selected = contacts.find((item) => item.id === selectedId) || null;

  const counts = useMemo(() => {
    return {
      active: contacts.filter((item) => (item.status || "active") === "active").length,
      archived: contacts.filter((item) => item.status === "archived").length,
      suppressed: contacts.filter((item) => item.do_not_disturb || item.email_status === "do_not_contact").length,
      missingEmail: contacts.filter((item) => !item.email).length,
    };
  }, [contacts]);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return contacts.filter((item) => {
      if (summary === "active" && (item.status || "active") !== "active") return false;
      if (summary === "archived" && item.status !== "archived") return false;
      if (summary === "suppressed" && !(item.do_not_disturb || item.email_status === "do_not_contact")) return false;
      if (summary === "missingEmail" && item.email) return false;
      if (!term) return true;
      return [displayName(item), orgName(item), item.email, item.website, item.industry].join(" ").toLowerCase().includes(term);
    });
  }, [contacts, query, summary]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const visible = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  async function save(patch: Partial<Contact>) {
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
    setContacts((current) => current.map((item) => (item.id === selected.id ? { ...item, ...patch, full_name: fullName } : item)));
    setMessage("Saved.");
  }

  async function archive() {
    if (!selected) return;
    const next = selected.status === "archived" ? "active" : "archived";
    await save({ status: next });
    if (next === "archived") setSummary("archived");
  }

  async function remove() {
    if (!selected) return;
    if (!window.confirm(`Delete ${displayName(selected)}? This cannot be undone.`)) return;
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.from("contacts").delete().eq("id", selected.id);
    if (error) {
      setMessage(error.message);
      return;
    }
    const remaining = contacts.filter((item) => item.id !== selected.id);
    setContacts(remaining);
    setSelectedId(remaining[0]?.id || "");
    setMessage("Deleted.");
  }

  async function createContact() {
    const supabase = createSupabaseBrowserClient();
    const { data, error } = await supabase
      .from("contacts")
      .insert({ workspace_id: workspaceId, full_name: "New contact", status: "active", email_status: "review_required" })
      .select("id, full_name, first_name, last_name, email, phone, business_name, job_title, industry, tags, source, email_status, street_address, city, state, postal_code, country, website, linkedin_url, status, do_not_disturb, research_notes")
      .single();
    if (error || !data) {
      setMessage(error?.message || "Run the contact record SQL first.");
      return;
    }
    setContacts((current) => [data, ...current]);
    setSelectedId(data.id);
    setSummary("active");
  }

  function exportCsv() {
    const header = ["Name", "Email", "Phone", "Company", "Title", "Industry", "Website"];
    const rows = filtered.map((item) => [displayName(item), item.email || "", item.phone || "", orgName(item), item.job_title || "", item.industry || "", item.website || ""]);
    const csv = [header, ...rows].map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "contacts.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="contacts-desk">
      <div className="contacts-top">
        <div>
          <h2>
            Contacts <span className="badge">Workspace contacts</span>
          </h2>
          <p className="meta">People, companies, and CRM history in one place.</p>
        </div>
        <div className="row">
          <button type="button" onClick={createContact}>+ New contact</button>
          <button type="button" className="chip" onClick={exportCsv}>Export CSV</button>
        </div>
      </div>
      <div className="kpi-row">
        <button type="button" className={summary === "active" ? "kpi kpi-dark" : "kpi"} onClick={() => { setSummary("active"); setPage(1); }}>
          <strong>{counts.active}</strong><span>Active</span>
        </button>
        <button type="button" className={summary === "archived" ? "kpi kpi-dark" : "kpi"} onClick={() => { setSummary("archived"); setPage(1); }}>
          <strong>{counts.archived}</strong><span>Archived</span>
        </button>
        <button type="button" className={summary === "suppressed" ? "kpi kpi-dark" : "kpi"} onClick={() => { setSummary("suppressed"); setPage(1); }}>
          <strong>{counts.suppressed}</strong><span>Suppressed</span>
        </button>
        <button type="button" className={summary === "missingEmail" ? "kpi kpi-dark" : "kpi"} onClick={() => { setSummary("missingEmail"); setPage(1); }}>
          <strong>{counts.missingEmail}</strong><span>Missing email</span>
        </button>
      </div>
      <div className="contacts-split">
        <aside className="contacts-list">
          <input value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); }} placeholder="Search name, company, email..." />
          <p className="meta">Showing {visible.length} of {filtered.length}</p>
          {visible.map((item) => {
            const name = displayName(item);
            const company = orgName(item);
            const site = host(item.website);
            return (
              <button key={item.id} type="button" className={item.id === selectedId ? "contact-row selected" : "contact-row"} onClick={() => setSelectedId(item.id)}>
                <strong>{name}</strong>
                {company && company.toLowerCase() !== name.toLowerCase() ? <span>{company}</span> : null}
                {site ? <small>{site}</small> : null}
                {item.do_not_disturb ? <em>DND</em> : null}
              </button>
            );
          })}
          <div className="row">
            <button type="button" className="chip" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</button>
            <span className="meta">Page {page} of {pages}</span>
            <button type="button" className="chip" disabled={page >= pages} onClick={() => setPage((value) => value + 1)}>Next</button>
          </div>
        </aside>
        <div className="contact-record card">
          {selected ? (
            <>
              <p className="kicker">Contact record</p>
              <h3>{displayName(selected)}</h3>
              {selected.website ? (
                <p>
                  <a href={selected.website.startsWith("http") ? selected.website : `https://${selected.website}`} target="_blank" rel="noreferrer">{selected.website}</a>
                </p>
              ) : null}
              <div className="row">
                <button type="button" className="chip" onClick={() => void archive()}>
                  {selected.status === "archived" ? "Restore" : "Archive"}
                </button>
                <button type="button" className="chip" onClick={() => void remove()}>Delete</button>
              </div>
              <ResearchButton
                contactId={selected.id}
                notes={selected.research_notes}
                onDone={(notes, extra) => {
                  setContacts((current) => current.map((item) => (item.id === selected.id ? { ...item, research_notes: notes, ...extra } : item)));
                  setMessage("Research saved.");
                }}
              />
              <div className="form-grid">
                <label>First name<input value={selected.first_name || ""} onChange={(e) => save({ first_name: e.target.value })} /></label>
                <label>Last name<input value={selected.last_name || ""} onChange={(e) => save({ last_name: e.target.value })} /></label>
                <label>Business name<input value={selected.business_name || orgName(selected)} onChange={(e) => save({ business_name: e.target.value })} /></label>
                <label>Email<input value={selected.email || ""} onChange={(e) => save({ email: e.target.value })} /></label>
                <label>Phone<input value={selected.phone || ""} onChange={(e) => save({ phone: e.target.value })} /></label>
                <label>Job title<input value={selected.job_title || ""} onChange={(e) => save({ job_title: e.target.value })} /></label>
                <label>Industry<input value={selected.industry || ""} onChange={(e) => save({ industry: e.target.value })} /></label>
                <label>
                  Email status
                  <select value={selected.email_status || "unknown"} onChange={(e) => save({ email_status: e.target.value })}>
                    {EMAIL_STATUSES.map((status) => <option key={status} value={status}>{status.replaceAll("_", " ")}</option>)}
                  </select>
                </label>
                <label>Source<input value={selected.source || ""} onChange={(e) => save({ source: e.target.value })} /></label>
                <label>Website<input value={selected.website || ""} onChange={(e) => save({ website: e.target.value })} /></label>
                <label>Tags<input value={(selected.tags || []).join(", ")} onChange={(e) => save({ tags: e.target.value.split(",").map((item) => item.trim()).filter(Boolean) })} /></label>
                <label>LinkedIn<input value={selected.linkedin_url || ""} onChange={(e) => save({ linkedin_url: e.target.value })} /></label>
              </div>
              <label className="dnd">
                <input type="checkbox" checked={Boolean(selected.do_not_disturb)} onChange={(e) => save({ do_not_disturb: e.target.checked })} />
                DND. Do not prepare or create email drafts for this contact.
              </label>
              <div className="form-grid">
                <label>Street address<input value={selected.street_address || ""} onChange={(e) => save({ street_address: e.target.value })} /></label>
                <label>City<input value={selected.city || ""} onChange={(e) => save({ city: e.target.value })} /></label>
                <label>State<input value={selected.state || ""} onChange={(e) => save({ state: e.target.value })} /></label>
                <label>Postal code<input value={selected.postal_code || ""} onChange={(e) => save({ postal_code: e.target.value })} /></label>
                <label>Country<input value={selected.country || "United States"} onChange={(e) => save({ country: e.target.value })} /></label>
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
