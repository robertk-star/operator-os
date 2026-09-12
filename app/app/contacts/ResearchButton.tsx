"use client";

import { useState } from "react";

export function ResearchButton({
  contactId,
  notes,
  onDone,
}: {
  contactId: string;
  notes?: string | null;
  onDone: (notes: string, extra?: { email?: string; linkedin_url?: string }) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function run() {
    setBusy(true);
    setError("");
    const response = await fetch("/api/contacts/research", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contactId }),
    });
    const payload = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) {
      setError(payload.error || "Research failed.");
      return;
    }
    onDone(payload.notes || "", payload.patch || {});
  }

  return (
    <div className="stack">
      <button type="button" disabled={busy} onClick={() => void run()}>
        {busy ? "Reading website..." : "Research website"}
      </button>
      {error ? <p className="meta">{error}</p> : null}
      {notes ? <pre className="mail-pre">{notes}</pre> : null}
    </div>
  );
}
