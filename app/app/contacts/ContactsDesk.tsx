"use client";

import { useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { ResearchButton } from "./ResearchButton";
import { ReviewToggle } from "./ReviewToggle";
import { PeopleFinder } from "./PeopleFinder";

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
  reviewed?: boolean | null;
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
function personName(contact: Contact) {
  return [contact.first_name, contact.last_name].map((part) => String(part || "").trim()).filter(Boolean).join(" ");
}
function displayName(contact: Contact) {
  return personName(contact) || contact.business_name || orgName(contact) || contact.full_name || "Untitled";
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
  const [summary, setSummary] = useState<"active" | "archived" | "suppressed" | "missingEmail" | "staffing">("active");
  const [reviewFilter, setReviewFilter] = useState<"all" | "reviewed" | "open">("all");
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState(initialContacts[0]?.id || "");
  const [message, setMessage] = useState("");

  const selected = contacts.find((item) => item.id === selectedId) || null;

  const counts = useMemo(() => {
    return {
      active: contacts.filter((item) => (item.status || "active") === "active").length,
      archived: contacts.filter((item) => item.status === "archived").length,
      staffing: contacts.filter((item) => item.status === "staffing").length,
      suppressed: contacts.filter((item) => item.do_not_disturb || item.email_status === "do_not_contact").length,
      missingEmail: contacts.filter((item) => !item.email).length,
    };
  }, [contacts]);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return contacts.filter((item) => {
      if (summary === "active" && (item.status || "active") !== "active") return false;
      if (summary === "archived" && item.status !== "archived") return false;
      if (summary === "staffing" && item.status !== "staffing") return false;
      if (summary === "suppressed" && !(item.do_not_disturb || item.email_status === "do_not_contact")) return false;
      if (summary === "missingEmail" && item.email) return false;
      if (reviewFilter === "reviewed" && !item.reviewed) return false;
      if (reviewFilter === "open" && item.reviewed) return false;
      if (!term) return true;
      return [displayName(item), orgName(item), item.email, item.website, item.industry].join(" ").toLowerCase().includes(term);
    });
  }, [contacts, query, summary, reviewFilter]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const visible = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  async function save(patch: Partial<Contact>) {
    if (!selected) return;
    const supabase = createSupabaseBrowserClient();
    const first = patch.first_name !== undefined ? patch.first_name : selected.first_name;
    const last = patch.last_name !== undefined ? patch.last_name : selected.last_name;
    const business = patch.business_name !== undefined ? patch.business_name : selected.business_name;
    const fullName =
      [first, last].map((part) => String(part || "").trim()).filter(Boolean).join(" ") ||
      business ||
      orgName(selected) ||
      "Untitled";
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
      .insert({ workspace_id: workspaceId, full_name: "New company lead", status: "active", record_type: "company", email_status: "missing", reviewed: false })
      .select("id, full_name, first_name, last_name, email, phone, business_name, job_title, industry, tags, source, email_status, street_address, city, state, postal_code, country, website, linkedin_url, status, do_not_disturb, research_notes, reviewed, organization_id")
      .single();
    if (error || !data) {
      setMessage(error?.message || "Run the record type SQL first.");
      return;
    }
    setContacts((current) => [data, ...current]);
    setSelectedId(data.id);
    setSummary("active");
  }

  function exportCsv() {
    const header = ["Name", "Email", "Phone", "Company", "Title", "Industry", "Website", "Reviewed"];
    const rows = filtered.map((item) => [displayName(item), item.email || "", item.phone || "", orgName(item), item.job_title || "", item.industry || "", item.website || "", item.reviewed ? "yes" : "no"]);
    const csv = [header, ...rows].map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "company-leads.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="contacts-desk">
      <div className="contacts-top">
        <div>
          <h2>
            Company leads <span className="badge">Vet companies first</span>
          </h2>
          <p className="meta">Research and review companies here. Finding people is only for reviewed leads.</p>
        </div>
        <div className="row">
          <button type="button" onClick={createContact}>+ New company</button>
          <button type="button" className="chip" onClick={exportCsv}>Export CSV</button>
        </div>
      </div>
      <div className="kpi-row">
        <button type="button" className={summary === "active" ? "kpi kpi-dark" : "kpi"} onClick={() => { setSummary("active"); setPage(1); }}>
          <strong>{counts.active}</strong><span>Active</span>
        </button>
        <button type="button" className={summary === "staffing" ? "kpi kpi-dark" : "kpi"} onClick={() => { setSummary("staffing"); setPage(1); }}>
          <strong>{counts.staffing}</strong><span>Staffing</span>
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
          <input value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); }} placeholder="Search company..." />
          <div className="row">
            <button type="button" className={reviewFilter === "all" ? "kpi-dark chip" : "chip"} onClick={() => { setReviewFilter("all"); setPage(1); }}>All</button>
            <button type="button" className={reviewFilter === "open" ? "kpi-dark chip" : "chip"} onClick={() => { setReviewFilter("open"); setPage(1); }}>Not reviewed</button>
            <button type="button" className={reviewFilter === "reviewed" ? "kpi-dark chip" : "chip"} onClick={() => { setReviewFilter("reviewed"); setPage(1); }}>Reviewed queue</button>
          </div>
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
                {item.reviewed ? <em>REVIEWED</em> : null}
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
              <p className="kicker">Company lead</p>
              <h3>{displayName(selected)}</h3>
              {selected.website ? (
                <p>
                  <a href={selected.website.startsWith("http") ? selected.website : `https://${selected.website}`} target="_blank" rel="noreferrer">{selected.website}</a>
                </p>
              ) : null}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div className="row">
                  <button type="button" className="chip" onClick={() => void archive()}>{selected.status === "archived" ? "Restore" : "Archive"}</button>
                  <button type="button" className="chip" onClick={() => void save({ status: "staffing" })}>Move to Staffing</button>
                  <button type="button" className="chip" onClick={() => void remove()}>Delete</button>
                </div>
                <ReviewToggle checked={Boolean(selected.reviewed)} onChange={(next) => void save({ reviewed: next })} />
              </div>
              <ResearchButton
                contactId={selected.id}
                notes={selected.research_notes}
                onDone={(notes, extra) => {
                  setContacts((current) => current.map((item) => (item.id === selected.id ? { ...item, research_notes: notes, ...extra } : item)));
                  setMessage("Research saved.");
                }}
              />
              <PeopleFinder
                workspaceId={workspaceId}
                companyId={selected.id}
                companyName={displayName(selected)}
                organizationId={selected.organization_id}
                website={selected.website}
                reviewed={Boolean(selected.reviewed)}
              />
              <div className="form-grid">
                <label>Business name<input value={selected.business_name || orgName(selected)} onChange={(e) => save({ business_name: e.target.value })} /></label>
                <label>Industry<input value={selected.industry || ""} onChange={(e) => save({ industry: e.target.value })} /></label>
                <label>Website<input value={selected.website || ""} onChange={(e) => save({ website: e.target.value })} /></label>
                <label>Source<input value={selected.source || ""} onChange={(e) => save({ source: e.target.value })} /></label>
              </div>
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
            <p>No company selected.</p>
          )}
        </div>
      </div>
    </div>
  );
}
