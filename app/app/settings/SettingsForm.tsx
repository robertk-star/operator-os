"use client";

import { FormEvent, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function SettingsForm({
  workspaceId,
  workspaceName,
  revenueTargets,
  locations,
  employeeRanges,
  keywords,
}: {
  workspaceId: string;
  workspaceName: string;
  revenueTargets: string;
  locations: string;
  employeeRanges: string;
  keywords: string;
}) {
  const [name, setName] = useState(workspaceName);
  const [targets, setTargets] = useState(revenueTargets);
  const [locationValue, setLocationValue] = useState(locations);
  const [rangeValue, setRangeValue] = useState(employeeRanges);
  const [keywordValue, setKeywordValue] = useState(keywords);
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
        metadata: {
          revenueTargets: targets,
          locations: locationValue,
          employeeRanges: rangeValue,
          keywords: keywordValue,
        },
      },
      { onConflict: "workspace_id,provider" }
    );
    if (nameResult.error || settingsResult.error) {
      setMessage(nameResult.error?.message || settingsResult.error?.message || "Could not save.");
      return;
    }
    setMessage("Saved. Revenue Engine will use these filters on the next Find companies.");
  }

  return (
    <form className="stack" onSubmit={save}>
      <label>
        Workspace name
        <input value={name} onChange={(e) => setName(e.target.value)} required />
      </label>
      <label>
        Locations
        <input
          value={locationValue}
          onChange={(e) => setLocationValue(e.target.value)}
          placeholder="United States, Texas"
        />
      </label>
      <label>
        Employee ranges
        <input
          value={rangeValue}
          onChange={(e) => setRangeValue(e.target.value)}
          placeholder="501,1000; 1001,5000; 5001,10000; 10001+"
        />
      </label>
      <p className="meta">Apollo ranges use min,max. Separate ranges with a semicolon. Example for 750+: 501,1000; 1001,5000; 5001,10000; 10001+</p>
      <label>
        Keywords
        <input value={keywordValue} onChange={(e) => setKeywordValue(e.target.value)} placeholder="employee benefits, HR" />
      </label>
      <label>
        Notes / qualified definition
        <textarea
          className="field"
          rows={4}
          value={targets}
          onChange={(e) => setTargets(e.target.value)}
          placeholder="What a good account looks like"
        />
      </label>
      <button type="submit">Save settings</button>
      {message ? <p>{message}</p> : null}
    </form>
  );
}
