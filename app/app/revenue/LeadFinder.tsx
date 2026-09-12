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

function domainOf(url: string) {
  try {
    return url ? new URL(url.startsWith("http") ? url : `https://${url}`).hostname.replace(/^www\./, "") : null;
  } catch {
    return null;
  }
}

function websiteOf(url: string) {
  const trimmed = url.trim();
  if (!trimmed) return null;
  return trimmed.startsWith("http") ? trimmed : `https://${trimmed}`;
}

export function LeadFinder({ workspaceId, defaultQuery }: { workspaceId: string; defaultQuery: string }) {
  const [query, setQuery] = useState(defaultQuery);
  const [items, setItems] = useState<Lead[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [page, setPage] = useState(1);
  const [nextPage, setNextPage] = useState(2);
  const [source, setSource] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  function keyFor(lead: Lead) {
    return `${lead.id || lead.name}-${lead.url}`;
  }

  async function findLeads(targetPage: number) {
    setBusy(true);
    setMessage("");
    const response = await fetch(`/api/revenue/leads?q=${encodeURIComponent(query)}&page=${targetPage}&t=${Date.now()}`);
    const payload = await response.json().catch(() => ({}));
    setBusy(false);
    const nextItems: Lead[] = payload.items || [];
    setItems(nextItems);
    setSelected(Object.fromEntries(nextItems.map((item) => [keyFor(item), true])));
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

  async function persist(lead: Lead) {
    const supabase = createSupabaseBrowserClient();
    const website = websiteOf(lead.url);
    const row: Record<string, unknown> = {
      workspace_id: workspaceId,
      name: lead.name,
      domain: domainOf(lead.url),
    };
    if (lead.id) row.apollo_organization_id = lead.id;
    let { data: organization, error: orgError } = await supabase.from("organizations").insert(row).select("id").single();
    if (orgError && lead.id) {
      const retry = await supabase.from("organizations").insert({ workspace_id: workspaceId, name: lead.name, domain: domainOf(lead.url) }).select("id").single();
      organization = retry.data;
      orgError = retry.error;
    }
    if (orgError || !organization) throw new Error(orgError?.message || `Could not save ${lead.name}`);
    const contactRow: Record<string, unknown> = {
      workspace_id: workspaceId,
      organization_id: organization.id,
      full_name: lead.name,
      business_name: lead.name,
      website,
      source: "apollo",
      email_status: "missing",
      status: "active",
    };
    let { data: contact, error: contactError } = await supabase.from("contacts").insert(contactRow).select("id").single();
    if (contactError) {
      const retry = await supabase
        .from("contacts")
        .insert({ workspace_id: workspaceId, organization_id: organization.id, full_name: lead.name, email: null })
        .select("id")
        .single();
      contact = retry.data;
      contactError = retry.error;
    }
    if (contactError || !contact) throw new Error(contactError?.message || `Could not save contact for ${lead.name}`);
    const { error: oppError } = await supabase.from("opportunities").insert({
      workspace_id: workspaceId,
      contact_id: contact.id,
      organization_id: organization.id,
      title: lead.name,
      stage: "new",
    });
    if (oppError) throw new Error(oppError.message);
  }

  async function saveChosen(leads: Lead[]) {
    setBusy(true);
    let saved = 0;
    const failed: string[] = [];
    for (const lead of leads) {
      try {
        await persist(lead);
        saved += 1;
      } catch (error) {
        failed.push(error instanceof Error ? error.message : String(error));
      }
    }
    setBusy(false);
    const savedKeys = new Set(leads.map(keyFor));
    setItems((current) => current.filter((item) => !savedKeys.has(keyFor(item)) || failed.some((text) => text.includes(item.name))));
    setMessage(failed.length ? `Saved ${saved}. ${failed[0]}` : `Saved ${saved} companies.`);
  }

  const chosen = items.filter((item) => selected[keyFor(item)]);

  return (
    <div className="stack wide">
      <p className="meta">
        Filters come from <Link href="/app/settings">Settings</Link>. Each Find or Next 100 uses 1 Apollo credit. Saving is free and stores the website.
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
          {busy ? "Working..." : "Find companies (page 1)"}
        </button>
      </form>
      <div className="row">
        <button type="button" className="chip" disabled={busy} onClick={() => void findLeads(nextPage)}>
          Next 100 companies (1 credit)
        </button>
        <button type="button" className="chip" disabled={!items.length} onClick={() => setSelected(Object.fromEntries(items.map((item) => [keyFor(item), true])))}>
          Select all
        </button>
        <button type="button" className="chip" disabled={!items.length} onClick={() => setSelected({})}>
          Select none
        </button>
        <button type="button" disabled={busy || !chosen.length} onClick={() => void saveChosen(chosen)}>
          Save selected ({chosen.length})
        </button>
      </div>
      {message ? <p className="meta">{message}</p> : null}
      <p className="meta">Page {page}.</p>
      <ul className="record-list">
        {items.map((item) => (
          <li key={keyFor(item)}>
            <label>
              <input
                type="checkbox"
                checked={Boolean(selected[keyFor(item)])}
                onChange={(event) => setSelected((current) => ({ ...current, [keyFor(item)]: event.target.checked }))}
              />
              <strong>{item.name}</strong>
              <div className="meta">{[item.source || source, item.location, item.url].filter(Boolean).join(" · ")}</div>
              <p>{item.snippet}</p>
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}
