"use client";

import { FormEvent, useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const STAGES = ["new", "qualified", "working", "won", "lost"] as const;
type Contact = { id: string; full_name: string };
type Opportunity = {
  id: string;
  title: string;
  stage: string;
  amount_cents: number | null;
  contact_id: string | null;
  contacts?: { full_name: string } | { full_name: string }[] | null;
};

function personName(item: Opportunity) {
  const value = item.contacts;
  if (Array.isArray(value)) return value[0]?.full_name;
  return value?.full_name;
}
function dollarsToCents(value: string) {
  const parsed = Number(value.replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.round(parsed * 100);
}
function formatMoney(cents: number | null) {
  if (cents == null) return "No amount";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

export function RevenueBoard({
  workspaceId,
  initialOpportunities,
  contacts,
  selectedContactId,
}: {
  workspaceId: string;
  initialOpportunities: Opportunity[];
  contacts: Contact[];
  selectedContactId: string;
}) {
  const [items, setItems] = useState(initialOpportunities);
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [contactId, setContactId] = useState(selectedContactId);
  const [stage, setStage] = useState<(typeof STAGES)[number]>("new");
  const [message, setMessage] = useState("");

  const totals = useMemo(() => {
    const open = items.filter((item) => item.stage !== "won" && item.stage !== "lost");
    const won = items.filter((item) => item.stage === "won");
    return {
      openCount: open.length,
      openCents: open.reduce((sum, item) => sum + (item.amount_cents || 0), 0),
      wonCents: won.reduce((sum, item) => sum + (item.amount_cents || 0), 0),
    };
  }, [items]);

  async function addOpportunity(event: FormEvent) {
    event.preventDefault();
    const supabase = createSupabaseBrowserClient();
    const { data, error } = await supabase
      .from("opportunities")
      .insert({
        workspace_id: workspaceId,
        title: title.trim(),
        stage,
        amount_cents: dollarsToCents(amount),
        contact_id: contactId || null,
      })
      .select("id, title, stage, amount_cents, contact_id, contacts(full_name)")
      .single();
    if (error || !data) {
      setMessage(error?.message || "Could not save opportunity.");
      return;
    }
    setItems((current) => [data, ...current]);
    setTitle("");
    setAmount("");
    setStage("new");
    setMessage("");
  }

  async function changeStage(id: string, next: string) {
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.from("opportunities").update({ stage, updated_at: new Date().toISOString() }).eq("id", id);
    if (error) {
      setMessage(error.message);
      return;
    }
    setItems((current) => current.map((item) => (item.id === id ? { ...item, stage: next } : item)));
  }

  return (
    <div className="stack wide">
      <p className="meta">
        Open {totals.openCount} · Pipeline {formatMoney(totals.openCents)} · Won {formatMoney(totals.wonCents)}
      </p>
      <form className="stack" onSubmit={addOpportunity}>
        <label>
          Opportunity
          <input value={title} onChange={(e) => setTitle(e.target.value)} required />
        </label>
        <label>
          Amount (USD)
          <input value={amount} onChange={(e) => setAmount(e.target.value)} />
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
          Stage
          <select value={stage} onChange={(e) => setStage(e.target.value as (typeof STAGES)[number])}>
            {STAGES.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <button type="submit">Add opportunity</button>
      </form>
      {message ? <p>{message}</p> : null}
      <ul className="record-list">
        {items.length === 0 ? <li>No opportunities yet.</li> : null}
        {items.map((item) => (
          <li key={item.id}>
            <div>
              <strong>{item.title}</strong>
              <div className="meta">{[formatMoney(item.amount_cents), personName(item) || "Unassigned", item.stage].join(" · ")}</div>
            </div>
            <label>
              Stage
              <select value={item.stage} onChange={(e) => changeStage(item.id, e.target.value)}>
                {STAGES.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}
