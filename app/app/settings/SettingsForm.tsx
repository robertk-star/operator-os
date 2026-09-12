"use client";

import { FormEvent, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function SettingsForm({
  workspaceId,
  workspaceName,
  revenueTargets,
}: {
  workspaceId: string;
  workspaceName: string;
  revenueTargets: string;
}) {
  const [name, setName] = useState(workspaceName);
  const [targets, setTargets] = useState(revenueTargets);
  const [message, setMessage] = useState("");

  async function save(event: FormEvent) {
    event.preventDefault();
    const supabase = createSupabaseBrowserClient();
    const nameResult = await supabase.from("workspaces").update({ name }).eq("id", workspaceId);
    const settingsResult = await supabase.from("integrations").upsert(
      {
        workspace_id: workspaceId,
        provider: "workspace",
        status: "connected",
        metadata: { revenueTargets: targets },
      },
      { onConflict: "workspace_id,provider" }
    );
    if (nameResult.error || settingsResult.error) {
      setMessage(nameResult.error?.message || settingsResult.error?.message || "Could not save.");
      return;
    }
    setMessage("Saved.");
  }

  return (
    <form className="stack" onSubmit={save}>
      <label>
        Workspace name
        <input value={name} onChange={(e) => setName(e.target.value)} required />
      </label>
      <label>
        Revenue Engine targets
        <textarea
          className="field"
          rows={6}
          value={targets}
          onChange={(e) => setTargets(e.target.value)}
          placeholder="Industries, company size, geography, and what a qualified opportunity looks like"
        />
      </label>
      <button type="submit">Save settings</button>
      {message ? <p>{message}</p> : null}
    </form>
  );
}
