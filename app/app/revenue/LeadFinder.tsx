"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type Lead = { name: string; url: string; snippet: string; employees?: string; location?: string };

export function LeadFinder({ workspaceId, defaultQuery }: { workspaceId: string; defaultQuery: string }) {
  const [query, setQuery] = useState(defaultQuery);
  const [items, setItems] = useState<Lead[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function findLeads(event?: FormEvent) {
    event?.preventDefault();
    setBusy(true);
    setMessage("");
    const response = await fetch(`/api/revenue/leads?q=${encodeURIComponent(query)}`);
    const payload = await response.json().catch(() => ({}));
    setBusy(false);
    setItems(payload.items || []);
    const filters = payload.filters
      ? `Locations: ${(payload.filters.locations || []).join(", ") || "none"}. Sizes: ${(payload.filters.employeeRanges || []).join("; ") || "none"}.`
      : "";
    setMessage(payload.error || filters || (payload.items?.length ? "" : "No companies found."));
  }

  async function saveLead(lead: Lead) {
    const supabase = createSupabaseBrowserClient();
    const domain = (() => {
      try {
        return lead.url ? new URL(lead.url.startsWith("http") ? lead.url : `https://${lead.url}`).hostname.replace(/^www\./, "") : null;
      } catch {
        return null;
      }
    })();
    const { data: organization, error: orgError } = await supabase
      .from("organizations")
      .insert({ workspace_id: workspaceId, name: lead.name, domain })
      .select("id")
      .single();
    if (orgError || !organization) {
      setMessage(orgError?.message || "Could not save organization.");
      return;
    }
    const { data: contact, error: contactError } = await supabase
      .from("contacts")
      .insert({ workspace_id: workspaceId, organization_id: organization.id, full_name: lead.name, email: null })
      .select("id")
      .single();
    if (contactError || !contact) {
      setMessage(contactError?.message || "Could not save contact.");
      return;
    }
    const { error: oppError } = await supabase.from("opportunities").insert({
      workspace_id: workspaceId,
      contact_id: contact.id,
      organization_id: organization.id,
      title: lead.name,
      stage: "new",
    });
    if (oppError) {
      setMessage(oppError.message);
      return;
    }
    setMessage(`Saved ${lead.name}.`);
    setItems((current) => current.filter((item) => item.name !== lead.name || item.url !== lead.url));
  }

  return (
    <div className="stack wide">
      <p className="meta">
        Filters come from <Link href="/app/settings">Settings</Link>. Change them there, not in code.
      </p>
      <form className="stack" onSubmit={findLeads}>
        <label>
          Extra keywords this search only
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Leave blank to use Settings keywords" />
        </label>
        <button type="submit" disabled={busy}>
          {busy ? "Finding companies..." : "Find companies"}
        </button>
      </form>
      {message ? <p className="meta">{message}</p> : null}
      <ul className="record-list">
        {items.map((item) => (
          <li key={`${item.name}-${item.url}`}>
            <div>
              <strong>{item.name}</strong>
              <div className="meta">{[item.location, item.employees ? `${item.employees} employees` : "", item.url].filter(Boolean).join(" · ")}</div>
              <p>{item.snippet}</p>
            </div>
            <button type="button" onClick={() => saveLead(item)}>
              Save lead
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
