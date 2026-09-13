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
  industries,
  excludeKeywords,
  excludeIndustries,
}: {
  workspaceId: string;
  workspaceName: string;
  revenueTargets: string;
  locations: string;
  employeeRanges: string;
  keywords: string;
  industries: string;
  excludeKeywords: string;
  excludeIndustries: string;
}) {
  const [name, setName] = useState(workspaceName);
  const [targets, setTargets] = useState(revenueTargets);
  const [locationValue, setLocationValue] = useState(locations);
  const [rangeValue, setRangeValue] = useState(employeeRanges);
  const [keywordValue, setKeywordValue] = useState(keywords);
  const [industryValue, setIndustryValue] = useState(industries);
  const [excludeKeywordValue, setExcludeKeywordValue] = useState(excludeKeywords);
  const [excludeIndustryValue, setExcludeIndustryValue] = useState(excludeIndustries);
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
          industries: industryValue,
          excludeKeywords: excludeKeywordValue,
          excludeIndustries: excludeIndustryValue,
        },
      },
      { onConflict: "workspace_id,provider" }
    );
    if (nameResult.error || settingsResult.error) {
      setMessage(nameResult.error?.message || settingsResult.error?.message || "Could not save.");
      return;
    }
    setMessage("Saved. Find companies will use these filters.");
  }

  return (
    <form className="stack" onSubmit={save}>
      <label>Workspace name<input value={name} onChange={(e) => setName(e.target.value)} required /></label>
      <label>Locations<input value={locationValue} onChange={(e) => setLocationValue(e.target.value)} placeholder="United States" /></label>
      <label>Employee ranges<input value={rangeValue} onChange={(e) => setRangeValue(e.target.value)} placeholder="1001,5000; 5001,10000; 10001+" /></label>
      <label>
        Industries to include
        <textarea className="field" rows={3} value={industryValue} onChange={(e) => setIndustryValue(e.target.value)} placeholder="Warehousing; Transportation/Trucking/Railroad; Wholesale; Retail" />
      </label>
      <label>
        Industries to exclude
        <textarea className="field" rows={2} value={excludeIndustryValue} onChange={(e) => setExcludeIndustryValue(e.target.value)} placeholder="Staffing & Recruiting" />
      </label>
      <label>Keywords to include<input value={keywordValue} onChange={(e) => setKeywordValue(e.target.value)} placeholder="warehouse, distribution, fulfillment" /></label>
      <label>Keywords to exclude<input value={excludeKeywordValue} onChange={(e) => setExcludeKeywordValue(e.target.value)} placeholder="staffing, recruiting, recruiter" /></label>
      <label>Notes / qualified definition<textarea className="field" rows={4} value={targets} onChange={(e) => setTargets(e.target.value)} /></label>
      <button type="submit">Save settings</button>
      {message ? <p>{message}</p> : null}
    </form>
  );
}
