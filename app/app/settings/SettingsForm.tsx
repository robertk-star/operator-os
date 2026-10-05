"use client";

import { FormEvent, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export type ApolloProfile = {
  id: string;
  name: string;
  revenueTargets: string;
  locations: string;
  employeeRanges: string;
  keywords: string;
  industries: string;
  excludeKeywords: string;
  excludeIndustries: string;
  personTitles: string;
};

function blankProfile(name = ""): ApolloProfile {
  return {
    id: crypto.randomUUID(),
    name,
    revenueTargets: "",
    locations: "United States",
    employeeRanges: "1001,5000; 5001,10000; 10001+",
    keywords: "",
    industries: "",
    excludeKeywords: "staffing, recruiting, recruiter, talent agency, employment agency",
    excludeIndustries: "Staffing & Recruiting",
    personTitles: "CEO; President; CFO; Director of HR; HR Director; Benefits Coordinator; Benefits Manager",
  };
}

export function SettingsForm({
  workspaceId,
  workspaceName,
  profiles,
}: {
  workspaceId: string;
  workspaceName: string;
  profiles: ApolloProfile[];
}) {
  const [name, setName] = useState(workspaceName);
  const [saved, setSaved] = useState<ApolloProfile[]>(profiles.map((item) => ({ ...blankProfile(), ...item, personTitles: item.personTitles || "" })));
  const [profileId, setProfileId] = useState(profiles[0]?.id || "");
  const current = saved.find((item) => item.id === profileId) || blankProfile();
  const [draft, setDraft] = useState<ApolloProfile>(current);
  const [message, setMessage] = useState("");

  function load(id: string) {
    const next = saved.find((item) => item.id === id);
    if (!next) return;
    setProfileId(id);
    setDraft(next);
  }

  function startNew() {
    const next = blankProfile("New search");
    setProfileId(next.id);
    setDraft(next);
    setMessage("Name this search, then save it.");
  }

  function patch(field: keyof ApolloProfile, value: string) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  async function persist(nextProfiles: ApolloProfile[], notice: string) {
    const supabase = createSupabaseBrowserClient();
    const nameResult = await supabase.from("workspaces").update({ name }).eq("id", workspaceId);
    const { data: existing } = await supabase.from("integrations").select("metadata").eq("workspace_id", workspaceId).eq("provider", "workspace").maybeSingle();
    const metadata = { ...((existing?.metadata || {}) as Record<string, unknown>), apolloProfiles: nextProfiles };
    const settingsResult = await supabase.from("integrations").upsert(
      { workspace_id: workspaceId, provider: "workspace", status: "connected", metadata },
      { onConflict: "workspace_id,provider" }
    );
    if (nameResult.error || settingsResult.error) {
      setMessage(nameResult.error?.message || settingsResult.error?.message || "Could not save.");
      return false;
    }
    setSaved(nextProfiles);
    setMessage(notice);
    return true;
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!draft.name.trim()) {
      setMessage("Name the search profile first.");
      return;
    }
    const next = { ...draft, name: draft.name.trim() };
    const nextProfiles = saved.some((item) => item.id === next.id)
      ? saved.map((item) => (item.id === next.id ? next : item))
      : [next, ...saved];
    const ok = await persist(nextProfiles, `Saved ${next.name}. Find people will use its title list.`);
    if (ok) {
      setProfileId(next.id);
      setDraft(next);
    }
  }

  async function remove() {
    if (!saved.some((item) => item.id === draft.id)) {
      startNew();
      return;
    }
    if (!window.confirm(`Delete search profile ${draft.name}?`)) return;
    const nextProfiles = saved.filter((item) => item.id !== draft.id);
    const ok = await persist(nextProfiles, `Deleted ${draft.name}.`);
    if (!ok) return;
    const fallback = nextProfiles[0] || blankProfile();
    setProfileId(fallback.id);
    setDraft(fallback);
  }

  return (
    <form className="stack" onSubmit={save}>
      <label>Workspace name<input value={name} onChange={(e) => setName(e.target.value)} required /></label>
      <div className="row">
        <label>
          Saved search profiles
          <select value={profileId} onChange={(e) => load(e.target.value)}>
            {!saved.some((item) => item.id === profileId) ? <option value={profileId}>Unsaved profile</option> : null}
            {saved.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="chip" onClick={startNew}>
          New search profile
        </button>
        <button type="button" className="chip" onClick={() => void remove()}>
          Delete profile
        </button>
      </div>
      <label>Profile name<input value={draft.name} onChange={(e) => patch("name", e.target.value)} placeholder="Home Services Frisco" required /></label>
      <label>Locations<input value={draft.locations} onChange={(e) => patch("locations", e.target.value)} placeholder="Frisco Texas" /></label>
      <label>Employee ranges<input value={draft.employeeRanges} onChange={(e) => patch("employeeRanges", e.target.value)} placeholder="1001,5000; 5001,10000; 10001+" /></label>
      <label>
        Industries to include
        <textarea className="field" rows={3} value={draft.industries} onChange={(e) => patch("industries", e.target.value)} placeholder="Warehousing; Transportation/Trucking/Railroad; Wholesale; Retail" />
      </label>
      <label>
        Industries to exclude
        <textarea className="field" rows={2} value={draft.excludeIndustries} onChange={(e) => patch("excludeIndustries", e.target.value)} placeholder="Staffing & Recruiting" />
      </label>
      <label>Keywords to include<input value={draft.keywords} onChange={(e) => patch("keywords", e.target.value)} placeholder="warehouse, distribution, fulfillment" /></label>
      <label>Keywords to exclude<input value={draft.excludeKeywords} onChange={(e) => patch("excludeKeywords", e.target.value)} placeholder="staffing, recruiting, recruiter" /></label>
      <label>
        Titles to find
        <textarea className="field" rows={3} value={draft.personTitles} onChange={(e) => patch("personTitles", e.target.value)} placeholder="CEO; President; Owner; Benefits Coordinator" />
      </label>
      <p className="meta">Separate titles with a semicolon. Find people uses this list only for companies saved from this search profile.</p>
      <label>Notes / qualified definition<textarea className="field" rows={4} value={draft.revenueTargets} onChange={(e) => patch("revenueTargets", e.target.value)} /></label>
      <button type="submit">Save search profile</button>
      {message ? <p>{message}</p> : null}
    </form>
  );
}
