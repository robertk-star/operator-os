"use client";

import { SequenceKpis } from "./SequenceKpis";

type Sequence = {
  id: string;
  name: string;
  status: string;
  audience_tags?: string[] | null;
  tag_match_mode?: string | null;
  external_campaign_id?: string | null;
  last_error?: string | null;
};
type Person = { email?: string | null; tags?: string[] | null };
type Enrollment = {
  id: string;
  sequence_id: string;
  status: string;
  contact_id: string;
  contacts?: { full_name: string; email: string | null } | { full_name: string; email: string | null }[] | null;
};

function enrollmentLabel(row: Enrollment) {
  const value = row.contacts;
  const person = Array.isArray(value) ? value[0] : value;
  return person ? `${person.full_name}${person.email ? ` · ${person.email}` : ""}` : row.contact_id;
}

export function SavedSequences({
  sequences,
  people,
  queued,
  busy,
  onEdit,
  onCopy,
  onControl,
}: {
  sequences: Sequence[];
  people: Person[];
  queued: Enrollment[];
  busy: boolean;
  onEdit: (sequence: Sequence) => void;
  onCopy: (sequence: Sequence) => void;
  onControl: (id: string, action: string) => void;
}) {
  return (
    <div className="card stack">
      <h3>Saved sequences</h3>
      {sequences.map((sequence) => (
        <div key={sequence.id} className="card stack">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <div>
              <strong>{sequence.name}</strong>
              <div className="meta">
                {sequence.status} · {queued.filter((row) => row.sequence_id === sequence.id).length} queued
                {sequence.external_campaign_id ? ` · Smartlead ${sequence.external_campaign_id}` : ""}
              </div>
            </div>
            <div className="row">
              <button type="button" className="chip" onClick={() => onEdit(sequence)}>Edit</button>
              <button type="button" className="chip" disabled={busy} onClick={() => onCopy(sequence)}>Copy</button>
              <button type="button" className="chip" disabled={busy} onClick={() => onControl(sequence.id, "activate")}>Activate</button>
              <button type="button" className="chip" disabled={busy} onClick={() => onControl(sequence.id, "pause")}>Pause</button>
              <button type="button" className="chip" disabled={busy} onClick={() => onControl(sequence.id, "stop")}>Stop</button>
            </div>
          </div>
          {sequence.last_error ? <p className="meta">{sequence.last_error}</p> : null}
          <SequenceKpis scope="sequence" sequence={sequence} people={people} enrollments={queued} />
          <ul className="record-list">
            {queued.filter((row) => row.sequence_id === sequence.id).map((row) => (
              <li key={row.id}>{enrollmentLabel(row)} · {row.status}</li>
            ))}
          </ul>
        </div>
      ))}
      {!sequences.length ? <p className="meta">No sequences yet.</p> : null}
    </div>
  );
}
