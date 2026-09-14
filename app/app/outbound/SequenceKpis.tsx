"use client";

import { useEffect, useMemo, useState } from "react";

type Person = { email?: string | null; tags?: string[] | null };
type Enrollment = { sequence_id: string; status: string };
type Sequence = { id: string; name: string; audience_tags?: string[] | null; tag_match_mode?: string | null; status: string };

export function SequenceKpis({
  sequences,
  people,
  enrollments,
}: {
  sequences: Sequence[];
  people: Person[];
  enrollments: Enrollment[];
}) {
  const focus = sequences.find((item) => item.status === "active") || sequences[0] || null;
  const tags = (focus?.audience_tags || []).map((item) => item.toLowerCase());
  const eligible = useMemo(() => {
    return people.filter((person) => {
      if (!person.email) return false;
      if (!tags.length) return true;
      const have = (person.tags || []).map((item) => item.toLowerCase());
      return focus?.tag_match_mode === "all" ? tags.every((tag) => have.includes(tag)) : tags.some((tag) => have.includes(tag));
    }).length;
  }, [people, focus?.id, focus?.tag_match_mode, tags.join(",")]);
  const added = focus ? enrollments.filter((row) => row.sequence_id === focus.id).length : enrollments.length;
  const [emailed, setEmailed] = useState(enrollments.filter((row) => ["active", "sent", "completed"].includes(row.status)).length);
  const [completed, setCompleted] = useState(enrollments.filter((row) => row.status === "completed").length);

  useEffect(() => {
    const query = focus?.id ? `?sequenceId=${focus.id}` : "";
    void fetch(`/api/outbound/stats${query}`)
      .then((response) => response.json())
      .then((payload) => {
        if (typeof payload.emailed === "number") setEmailed(payload.emailed);
        if (typeof payload.completed === "number") setCompleted(payload.completed);
      })
      .catch(() => undefined);
  }, [focus?.id]);

  const cards = [
    ["Eligible people", eligible],
    ["Added to sequence", added],
    ["Emailed at least once", emailed],
    ["Completed sequence", completed],
  ] as const;

  return (
    <div className="kpi-row" style={{ gridTemplateColumns: "repeat(4, minmax(0, 1fr))", marginTop: 8 }}>
      {cards.map(([label, value], index) => (
        <div key={label} className={index === 0 ? "kpi kpi-dark card" : "kpi card"} style={{ marginBottom: 0 }}>
          <span className="kicker">{label}</span>
          <strong>{value}</strong>
          {focus ? <p className="meta">{focus.name}</p> : <p className="meta">All sequences</p>}
        </div>
      ))}
    </div>
  );
}
