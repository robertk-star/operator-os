"use client";

import { FormEvent, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type Lead = { name: string; url: string; snippet: string };

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
    setMessage(payload.error || (payload.items?.length ? "" : "No companies found for that target."));
  }

  async function saveLead(lead: Lead) {
    const supabase = createSupabaseBrowserClient();
    const domain = (() => {
      try {
        return new URL(lead.url).hostname.replace(/^www\./, "");
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
      .insert({
        workspace_id: workspaceId,
        organization_id: organization.id,
        full_name: lead.name,
        email: null,
      })
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
    setMessage(`Saved ${lead.name} as a contact and new opportunity.`);
    setItems((current) => current.filter((item) => item.url !== lead.url));
  }

  return (
    <div className="stack wide">
      <form className="stack" onSubmit={findLeads}>
        <label>
          What are you looking for?
          <textarea className="field" rows={4} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Industries, company size, geography, keywords" />
        </label>
        <button type="submit" disabled={busy}>
          {busy ? "Finding leads..." : "Find leads"}
        </button>
      </form>
      {message ? <p className="meta">{message}</p> : null}
      <ul className="record-list">
        {items.map((item) => (
          <li key={item.url}>
            <div>
              <strong>{item.name}</strong>
              <div className="meta">{item.url}</div>
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
