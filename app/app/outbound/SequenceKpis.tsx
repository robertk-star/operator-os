"use client";

import { useEffect, useMemo, useState } from "react";

type Person = { email?: string | null; tags?: string[] | null };
type Enrollment = { sequence_id: string; status: string };
type Sequence = { id: string; name: string; audience_tags?: string[] | null; tag_match_mode?: string | null; status: string };

function matchesTags(person: Person, sequence?: Sequence | null) {
  if (!person.email) return false;
  const tags = (sequence?.audience_tags || []).map((item) => item.toLowerCase());
  if (!tags.length) return true;
  const have = (person.tags || []).map((item) => item.toLowerCase());
  return sequence?.tag_match_mode === "all" ? tags.every((tag) => have.includes(tag)) : tags.some((tag) => have.includes(tag));
}

export function SequenceKpis({
  sequences = [],
  sequence,
  people,
  enrollments,
  scope = "all",
}: {
  sequences?: Sequence[];
  sequence?: Sequence | null;
  people: Person[];
  enrollments: Enrollment[];
  scope?: "all" | "sequence";
}) {
  const target = scope === "sequence" ? sequence || null : null;
  const eligible = useMemo(() => {
    if (target) return people.filter((person) => matchesTags(person, target)).length;
    return people.filter((person) => Boolean(person.email)).length;
  }, [people, target?.id, target?.tag_match_mode, (target?.audience_tags || []).join(",")]);
  const added = target ? enrollments.filter((row) => row.sequence_id === target.id).length : enrollments.length;
  const localEmailed = (target ? enrollments.filter((row) => row.sequence_id === target.id) : enrollments).filter((row) =>
    ["active", "sent", "completed"].includes(row.status)
  ).length;
  const localCompleted = (target ? enrollments.filter((row) => row.sequence_id === target.id) : enrollments).filter((row) => row.status === "completed").length;
  const [emailed, setEmailed] = useState(localEmailed);
  const [completed, setCompleted] = useState(localCompleted);

  useEffect(() => {
    const query = target?.id ? `?sequenceId=${target.id}` : "";
    void fetch(`/api/outbound/stats${query}`)
      .then((response) => response.json())
      .then((payload) => {
        if (typeof payload.emailed === "number") setEmailed(payload.emailed);
        if (typeof payload.completed === "number") setCompleted(payload.completed);
      })
      .catch(() => undefined);
  }, [target?.id]);

  const cards = [
    ["Eligible people", eligible],
    ["Added to sequence", added],
    ["Emailed at least once", emailed],
    ["Completed sequence", completed],
  ] as const;

  return (
    <div className="kpi-row" style={{ gridTemplateColumns: "repeat(4, minmax(0, 1fr))", margin: "12px 0" }}>
      {cards.map(([label, value], index) => (
        <div key={label} className={index === 0 ? "kpi kpi-dark card" : "kpi card"} style={{ marginBottom: 0 }}>
          <span className="kicker">{label}</span>
          <strong>{value}</strong>
          <p className="meta">{scope === "sequence" ? sequence?.name || "This sequence" : "All campaigns"}</p>
        </div>
      ))}
    </div>
  );
}
