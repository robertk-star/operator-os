"use client";

import { useEffect, useMemo, useState } from "react";

type Sequence = { id: string; name: string; status: string };
type Enrollment = { id: string; sequence_id: string; contact_id: string; status: string };

export function EnrollDrip({
  contactId,
  email,
  enrolledName,
  onEnrolled,
}: {
  contactId: string;
  email?: string | null;
  enrolledName?: string | null;
  onEnrolled: (name: string, sequenceId: string) => void;
}) {
  const [sequences, setSequences] = useState<Sequence[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [sequenceId, setSequenceId] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    void fetch("/api/outbound/enroll", { credentials: "include" })
      .then((response) => response.json())
      .then((payload) => {
        const rows: Sequence[] = payload.sequences || [];
        setSequences(rows);
        setEnrollments(payload.enrollments || []);
        const active = rows.find((item) => item.status === "active") || rows[0];
        if (active) setSequenceId(active.id);
      })
      .catch(() => setMessage("Could not load campaigns."));
  }, []);

  const active = useMemo(
    () => sequences.filter((item) => ["active", "running"].includes(item.status)),
    [sequences]
  );
  const options = active.length ? active : sequences;
  const mine = enrollments.filter((item) => item.contact_id === contactId);

  async function enroll() {
    if (!sequenceId) {
      setMessage("Create an outbound sequence first.");
      return;
    }
    if (!email) {
      setMessage("Add an email before enrolling.");
      return;
    }
    setBusy(true);
    const response = await fetch("/api/outbound/enroll", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ contactId, sequenceId }),
    });
    const payload = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) {
      setMessage(payload.error || "Could not enroll.");
      return;
    }
    if (payload.enrollment) {
      setEnrollments((current) => [payload.enrollment, ...current.filter((item) => item.id !== payload.enrollment.id)]);
    }
    onEnrolled(payload.sequence?.name || "Campaign", sequenceId);
    setMessage(payload.already ? `Already enrolled in ${payload.sequence?.name}.` : `Enrolled in ${payload.sequence?.name}.`);
  }

  return (
    <div className="stack" style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid #d7deea" }}>
      <p className="kicker">Drip campaign</p>
      <h3>Enroll in drip campaign</h3>
      {enrolledName ? <p className="meta">Flagged as enrolled in {enrolledName}.</p> : null}
      {mine.length ? (
        <p className="meta">
          {mine.map((item) => {
            const name = sequences.find((sequence) => sequence.id === item.sequence_id)?.name || "Campaign";
            return `${name} (${item.status})`;
          }).join(" · ")}
        </p>
      ) : null}
      <label>
        Active campaigns
        <select value={sequenceId} onChange={(event) => setSequenceId(event.target.value)}>
          <option value="">Select a campaign</option>
          {options.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name} ({item.status})
            </option>
          ))}
        </select>
      </label>
      {!options.length ? <p className="meta">No campaigns yet. Create one under Outbound Sequences.</p> : null}
      <button type="button" disabled={busy} onClick={() => void enroll()} style={{ background: "#17243f", color: "#fff", border: 0 }}>
        {busy ? "Enrolling..." : "Enroll in drip campaign"}
      </button>
      {message ? <p className="meta">{message}</p> : null}
    </div>
  );
}
