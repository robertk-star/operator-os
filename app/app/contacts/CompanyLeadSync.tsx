"use client";

import { useEffect } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const SELECT =
  "id, full_name, first_name, last_name, email, phone, business_name, job_title, industry, tags, source, email_status, street_address, city, state, postal_code, country, website, linkedin_url, status, do_not_disturb, research_notes, researched_at, reviewed, organization_id, organizations(name, domain)";

export function CompanyLeadSync({
  workspaceId,
  onLoad,
}: {
  workspaceId: string;
  onLoad: (rows: unknown[]) => void;
}) {
  useEffect(() => {
    async function load() {
      if (!workspaceId) return;
      const supabase = createSupabaseBrowserClient();
      const { data } = await supabase.from("contacts").select(SELECT).eq("workspace_id", workspaceId).eq("record_type", "company").order("full_name");
      if (data) onLoad(data);
    }
    void load();
    const onFocus = () => void load();
    window.addEventListener("focus", onFocus);
    const timer = window.setInterval(() => void load(), 15000);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.clearInterval(timer);
    };
  }, [workspaceId, onLoad]);
  return null;
}
