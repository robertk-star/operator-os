"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type Lead = {
  id?: string;
  name: string;
  url: string;
  snippet: string;
  employees?: string;
  location?: string;
  source?: string;
};

export function LeadFinder({ workspaceId, defaultQuery }: { workspaceId: string; defaultQuery: string }) {
  const [query, setQuery] = useState(defaultQuery);
  const [items, setItems] = useState<Lead[]>([]);
  const [page, setPage] = useState(1);
  const [nextPage, setNextPage] = useState(2);
  const [source, setSource] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function findLeads(targetPage: number) {
    setBusy(true);
    setMessage("");
    const response = await fetch(`/api/revenue/leads?q=${encodeURIComponent(query)}&page=${targetPage}&t=${Date.now()}`);
    const payload = await response.json().catch(() => ({}));
    setBusy(false);
    setItems(payload.items || []);
    setSource(payload.source || "");
    setPage(payload.page || targetPage);
    setNextPage(payload.nextPage || targetPage + 1);
    setMessage(
      [
        payload.source ? `Source: ${payload.source}` : "",
        payload.page ? `Page ${payload.page}` : "",
        payload.fetched != null ? `fetched ${payload.fetched}` : "",
        payload.skipped ? `skipped ${payload.skipped} already saved` : "",
        payload.error || "",
      ]
        .filter(Boolean)
        .join(". ")
    );
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
    const row: Record<string, unknown> = {
      workspace_id: workspaceId,
      name: lead.name,
      domain,
    };
    if (lead.id) row.apollo_organization_id = lead.id;
    let { data: organization, error: orgError } = await supabase.from("organizations").insert(row).select("id").single();
    if (orgError && lead.id) {
      const retry = await supabase.from("organizations").insert({ workspace_id: workspaceId, name: lead.name, domain }).select("id").single();
      organization = retry.data;
      orgError = retry.error;
    }
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
        Filters come from <Link href="/app/settings">Settings</Link>. Each Find or Next 100 uses 1 Apollo credit.
      </p>
      <form
        className="stack"
        onSubmit={(event: FormEvent) => {
          event.preventDefault();
          void findLeads(1);
        }}
      >
        <label>
          Extra keywords this search only
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Leave blank to use Settings keywords" />
        </label>
        <button type="submit" disabled={busy}>
          {busy ? "Finding companies..." : "Find companies (page 1)"}
        </button>
      </form>
      <button type="button" className="chip" disabled={busy} onClick={() => void findLeads(nextPage)}>
        Next 100 companies (page {nextPage}, 1 credit)
      </button>
      {message ? <p className="meta">{message}</p> : null}
      {source === "web" ? <p className="meta">These are website results, not Apollo.</p> : null}
      <p className="meta">Current page {page}.</p>
      <ul className="record-list">
        {items.map((item) => (
          <li key={`${item.id || item.name}-${item.url}`}>
            <div>
              <strong>{item.name}</strong>
              <div className="meta">{[item.source || source, item.location, item.url].filter(Boolean).join(" · ")}</div>
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
