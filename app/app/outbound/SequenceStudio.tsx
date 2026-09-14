"use client";

import { useEffect, useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type Sequence = {
  id: string;
  name: string;
  status: string;
  audience?: string | null;
  audience_tags?: string[] | null;
  tag_match_mode?: string | null;
  time_zone?: string | null;
  sending_days?: number[] | null;
  start_hour?: string | null;
  end_hour?: string | null;
  min_minutes_between_emails?: number | null;
  max_leads_per_day?: number | null;
  unsubscribe_text?: string | null;
  sender_postal_address?: string | null;
  sending_account_ids?: string[] | null;
  external_campaign_id?: string | null;
  last_error?: string | null;
};
type Step = { id?: string; sequence_id?: string; step_order: number; delay_days: number; subject: string; body_text: string };
type Person = {
  id: string;
  full_name: string;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  job_title?: string | null;
  business_name?: string | null;
  tags?: string[] | null;
};
type Enrollment = {
  id: string;
  sequence_id: string;
  contact_id: string;
  status: string;
  contacts?: { full_name: string; email: string | null } | { full_name: string; email: string | null }[] | null;
};
type Mailbox = { id: string; email: string; from_name?: string; status?: string };

const DAYS = [
  { id: 1, label: "Mon" },
  { id: 2, label: "Tue" },
  { id: 3, label: "Wed" },
  { id: 4, label: "Thu" },
  { id: 5, label: "Fri" },
  { id: 6, label: "Sat" },
  { id: 7, label: "Sun" },
];

function tagsOf(value?: string[] | null) {
  return (value || []).map((item) => item.toLowerCase());
}
function personName(person: Person) {
  return [person.first_name, person.last_name].filter(Boolean).join(" ") || person.full_name;
}
function enrollmentLabel(row: Enrollment) {
  const value = row.contacts;
  const person = Array.isArray(value) ? value[0] : value;
  return person ? `${person.full_name}${person.email ? ` · ${person.email}` : ""}` : row.contact_id;
}

export function SequenceStudio({
  workspaceId,
  initialSequences,
  initialSteps,
  people,
  enrollments,
}: {
  workspaceId: string;
  initialSequences: Sequence[];
  initialSteps: Step[];
  people: Person[];
  enrollments: Enrollment[];
}) {
  const [sequences, setSequences] = useState(initialSequences);
  const [steps, setSteps] = useState(initialSteps);
  const [queued, setQueued] = useState(enrollments);
  const [sequenceId, setSequenceId] = useState("");
  const [name, setName] = useState("");
  const [audienceTags, setAudienceTags] = useState("");
  const [tagMatchMode, setTagMatchMode] = useState("any");
  const [timeZone, setTimeZone] = useState("America/Chicago");
  const [sendingDays, setSendingDays] = useState([1, 2, 3, 4, 5]);
  const [startHour, setStartHour] = useState("09:00");
  const [endHour, setEndHour] = useState("16:00");
  const [gap, setGap] = useState(15);
  const [dailyLimit, setDailyLimit] = useState(25);
  const [postal, setPostal] = useState("");
  const [unsub, setUnsub] = useState("Reply unsubscribe to stop future messages.");
  const [draftSteps, setDraftSteps] = useState<Step[]>([{ step_order: 1, delay_days: 0, subject: "", body_text: "" }]);
  const [mailboxIds, setMailboxIds] = useState<string[]>([]);
  const [mailboxes, setMailboxes] = useState<Mailbox[]>([]);
  const [connected, setConnected] = useState(false);
  const [message, setMessage] = useState("");
  const [preview, setPreview] = useState<{ total: number; eligible: number } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void fetch("/api/smartlead")
      .then((response) => response.json())
      .then((payload) => {
        setConnected(payload.connection?.status === "connected");
        setMailboxes(payload.accounts || []);
      })
      .catch(() => setConnected(false));
  }, []);

  const wantedTags = audienceTags.split(/[;,]/).map((item) => item.trim().toLowerCase()).filter(Boolean);
  const eligible = useMemo(() => {
    return people.filter((person) => {
      if (!person.email) return false;
      if (!wantedTags.length) return true;
      const have = tagsOf(person.tags);
      return tagMatchMode === "all" ? wantedTags.every((tag) => have.includes(tag)) : wantedTags.some((tag) => have.includes(tag));
    });
  }, [people, audienceTags, tagMatchMode]);

  function loadSequence(sequence: Sequence) {
    setSequenceId(sequence.id);
    setName(sequence.name);
    setAudienceTags((sequence.audience_tags || []).join(", ") || sequence.audience || "");
    setTagMatchMode(sequence.tag_match_mode || "any");
    setTimeZone(sequence.time_zone || "America/Chicago");
    setSendingDays(sequence.sending_days?.length ? sequence.sending_days : [1, 2, 3, 4, 5]);
    setStartHour(String(sequence.start_hour || "09:00").slice(0, 5));
    setEndHour(String(sequence.end_hour || "16:00").slice(0, 5));
    setGap(sequence.min_minutes_between_emails || 15);
    setDailyLimit(sequence.max_leads_per_day || 25);
    setPostal(sequence.sender_postal_address || "");
    setUnsub(sequence.unsubscribe_text || "Reply unsubscribe to stop future messages.");
    setMailboxIds(sequence.sending_account_ids || []);
    const existing = steps.filter((step) => step.sequence_id === sequence.id).sort((a, b) => a.step_order - b.step_order);
    setDraftSteps(existing.length ? existing : [{ step_order: 1, delay_days: 0, subject: "", body_text: "" }]);
    setPreview(null);
    setMessage(sequence.last_error || "");
  }

  function resetForm() {
    setSequenceId("");
    setName("");
    setAudienceTags("");
    setMailboxIds([]);
    setDraftSteps([{ step_order: 1, delay_days: 0, subject: "", body_text: "" }]);
    setPreview(null);
  }

  async function saveDraft() {
    if (!name.trim()) {
      setMessage("Name the sequence first.");
      return;
    }
    const supabase = createSupabaseBrowserClient();
    const row = {
      workspace_id: workspaceId,
      name: name.trim(),
      status: "draft",
      audience: audienceTags,
      audience_tags: wantedTags,
      tag_match_mode: tagMatchMode,
      time_zone: timeZone,
      sending_days: sendingDays,
      start_hour: startHour,
      end_hour: endHour,
      min_minutes_between_emails: gap,
      max_leads_per_day: dailyLimit,
      sender_postal_address: postal,
      unsubscribe_text: unsub,
      sending_account_ids: mailboxIds,
    };
    const saved = sequenceId
      ? await supabase.from("outbound_sequences").update(row).eq("id", sequenceId).select("*").single()
      : await supabase.from("outbound_sequences").insert(row).select("*").single();
    if (saved.error || !saved.data) {
      setMessage(saved.error?.message || "Run the outbound builder SQL first.");
      return;
    }
    const id = saved.data.id;
    await supabase.from("outbound_sequence_steps").delete().eq("sequence_id", id);
    const stepRows = draftSteps.map((step, index) => ({
      workspace_id: workspaceId,
      sequence_id: id,
      step_order: index + 1,
      delay_days: Number(step.delay_days) || 0,
      subject: step.subject,
      body_text: step.body_text,
    }));
    const stepSave = await supabase.from("outbound_sequence_steps").insert(stepRows).select("id, sequence_id, step_order, delay_days, subject, body_text");
    setSequenceId(id);
    setSequences((current) => [saved.data, ...current.filter((item) => item.id !== id)]);
    setSteps((current) => [...(stepSave.data || []), ...current.filter((item) => item.sequence_id !== id)]);
    setMessage("Draft saved.");
  }

  async function enrollEligible() {
    if (!sequenceId) {
      setMessage("Save the draft first.");
      return;
    }
    const supabase = createSupabaseBrowserClient();
    let added = 0;
    for (const person of eligible) {
      const already = queued.some((row) => row.sequence_id === sequenceId && row.contact_id === person.id);
      if (already) continue;
      const { data, error } = await supabase
        .from("sequence_enrollments")
        .insert({ workspace_id: workspaceId, sequence_id: sequenceId, contact_id: person.id, status: "queued" })
        .select("id, sequence_id, contact_id, status, contacts(full_name, email)")
        .single();
      if (!error && data) {
        added += 1;
        setQueued((current) => [data, ...current]);
      }
    }
    setMessage(`Queued ${added} contacts locally. Activate to push them into Smartlead.`);
  }

  async function control(id: string, action: string) {
    setBusy(true);
    const response = await fetch("/api/outbound/activate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sequenceId: id, action }),
    });
    const payload = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) {
      setMessage(payload.error || "Smartlead request failed.");
      return;
    }
    setSequences((current) => current.map((item) => (item.id === id ? { ...item, status: payload.status || action, external_campaign_id: payload.campaignId || item.external_campaign_id } : item)));
    setMessage(payload.enrolled ? `Active in Smartlead. ${payload.enrolled} leads uploaded.` : `Sequence ${payload.status}.`);
  }

  return (
    <div className="stack wide">
      {!connected ? <p className="meta">Smartlead is not connected. Open Admin, paste the API key, and sync mailboxes first.</p> : null}
      <div className="card stack">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h3>{sequenceId ? "Edit draft" : "New sequence"}</h3>
          {sequenceId ? (
            <button type="button" className="chip" onClick={resetForm}>
              Start a new draft
            </button>
          ) : null}
        </div>
        <div className="form-grid">
          <label>Sequence name<input value={name} onChange={(e) => setName(e.target.value)} placeholder="Benefitsme HR outreach" /></label>
          <label>Contact tags<input value={audienceTags} onChange={(e) => setAudienceTags(e.target.value)} placeholder="hr, benefits" /></label>
          <label>
            Tag match
            <select value={tagMatchMode} onChange={(e) => setTagMatchMode(e.target.value)}>
              <option value="any">Any selected tag</option>
              <option value="all">All selected tags</option>
            </select>
          </label>
          <label>Time zone<input value={timeZone} onChange={(e) => setTimeZone(e.target.value)} /></label>
          <label>Daily contact limit<input type="number" min={1} value={dailyLimit} onChange={(e) => setDailyLimit(Number(e.target.value))} /></label>
          <label>Minutes apart<input type="number" min={1} value={gap} onChange={(e) => setGap(Number(e.target.value))} /></label>
          <label>Start<input type="time" value={startHour} onChange={(e) => setStartHour(e.target.value)} /></label>
          <label>End<input type="time" value={endHour} onChange={(e) => setEndHour(e.target.value)} /></label>
        </div>
        <div>
          <p className="meta">Sending mailboxes</p>
          <div className="row">
            {mailboxes.map((account) => (
              <label key={account.id} className="chip">
                <input
                  type="checkbox"
                  checked={mailboxIds.includes(String(account.id))}
                  onChange={() => setMailboxIds((current) => (current.includes(String(account.id)) ? current.filter((item) => item !== String(account.id)) : [...current, String(account.id)]))}
                />
                {account.email}
              </label>
            ))}
          </div>
          {!mailboxes.length ? <p className="meta">No mailboxes synced. Use Admin → Sync mailboxes.</p> : null}
        </div>
        <div>
          <p className="meta">Sending days</p>
          <div className="row">
            {DAYS.map((day) => (
              <button
                key={day.id}
                type="button"
                className={sendingDays.includes(day.id) ? "kpi-dark chip" : "chip"}
                onClick={() => setSendingDays((current) => (current.includes(day.id) ? current.filter((item) => item !== day.id) : [...current, day.id].sort()))}
              >
                {day.label}
              </button>
            ))}
          </div>
        </div>
        <label>Business postal address<input value={postal} onChange={(e) => setPostal(e.target.value)} /></label>
        <label>Unsubscribe text<input value={unsub} onChange={(e) => setUnsub(e.target.value)} /></label>
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h3>Message steps</h3>
          <button type="button" className="chip" onClick={() => setDraftSteps((current) => [...current, { step_order: current.length + 1, delay_days: 2, subject: "", body_text: "" }])}>
            Add step
          </button>
        </div>
        {draftSteps.map((step, index) => (
          <div key={index} className="card stack">
            <div className="row" style={{ justifyContent: "space-between" }}>
              <strong>Step {index + 1}</strong>
              {draftSteps.length > 1 ? (
                <button type="button" className="chip" onClick={() => setDraftSteps((current) => current.filter((_, row) => row !== index))}>
                  Remove
                </button>
              ) : null}
            </div>
            <div className="form-grid">
              <label>Delay in days<input type="number" min={0} value={step.delay_days} onChange={(e) => setDraftSteps((current) => current.map((item, row) => (row === index ? { ...item, delay_days: Number(e.target.value) } : item)))} /></label>
              <label>Subject<input value={step.subject} onChange={(e) => setDraftSteps((current) => current.map((item, row) => (row === index ? { ...item, subject: e.target.value } : item)))} /></label>
            </div>
            <label>Message<textarea className="field" rows={6} value={step.body_text} onChange={(e) => setDraftSteps((current) => current.map((item, row) => (row === index ? { ...item, body_text: e.target.value } : item)))} /></label>
          </div>
        ))}
        <div className="row">
          <button type="button" onClick={() => void saveDraft()} style={{ background: "#17243f", color: "#fff", border: 0 }}>
            Save draft
          </button>
          <button type="button" className="chip" onClick={() => setPreview({ total: people.filter((item) => item.email).length, eligible: eligible.length })}>
            Preview audience
          </button>
          <button type="button" className="chip" onClick={() => void enrollEligible()}>
            Enroll eligible contacts
          </button>
          <button type="button" disabled={busy || !sequenceId} onClick={() => void control(sequenceId, "activate")}>
            {busy ? "Publishing..." : "Activate in Smartlead"}
          </button>
        </div>
        {preview ? <p className="meta">{preview.eligible} eligible of {preview.total} people with emails.</p> : null}
        {message ? <p className="meta">{message}</p> : null}
      </div>
      <div className="card stack">
        <h3>Saved sequences</h3>
        {sequences.map((sequence) => (
          <div key={sequence.id} className="card stack">
            <div className="row" style={{ justifyContent: "space-between" }}>
              <div>
                <strong>{sequence.name}</strong>
                <div className="meta">{sequence.status} · {queued.filter((row) => row.sequence_id === sequence.id).length} queued{sequence.external_campaign_id ? ` · Smartlead ${sequence.external_campaign_id}` : ""}</div>
              </div>
              <div className="row">
                <button type="button" className="chip" onClick={() => loadSequence(sequence)}>Edit</button>
                <button type="button" className="chip" disabled={busy} onClick={() => void control(sequence.id, "activate")}>Activate</button>
                <button type="button" className="chip" disabled={busy} onClick={() => void control(sequence.id, "pause")}>Pause</button>
                <button type="button" className="chip" disabled={busy} onClick={() => void control(sequence.id, "stop")}>Stop</button>
              </div>
            </div>
            {sequence.last_error ? <p className="meta">{sequence.last_error}</p> : null}
            <ul className="record-list">
              {queued.filter((row) => row.sequence_id === sequence.id).map((row) => (
                <li key={row.id}>{enrollmentLabel(row)} · {row.status}</li>
              ))}
            </ul>
          </div>
        ))}
        {!sequences.length ? <p className="meta">No sequences yet.</p> : null}
      </div>
      <div className="card stack">
        <h3>Eligible people preview</h3>
        {eligible.slice(0, 25).map((person) => (
          <div key={person.id} className="meta">
            {personName(person)} · {person.job_title || ""} · {person.business_name || ""} · {person.email}
          </div>
        ))}
        {!eligible.length ? <p className="meta">No people contacts with emails match those tags yet.</p> : null}
      </div>
    </div>
  );
}
