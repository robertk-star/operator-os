"use client";

import { FormEvent, useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function SetupPage() {
  const [name, setName] = useState("");
  const [mode, setMode] = useState<"solo" | "team">("solo");
  const [message, setMessage] = useState("Checking workspace...");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    async function boot() {
      await supabase.rpc("accept_pending_invites");
      const { data, error } = await supabase.from("workspace_members").select("workspace_id").limit(1);
      if (error) {
        setMessage(error.message);
        setReady(true);
        return;
      }
      if (data && data.length > 0) {
        window.location.href = "/app/email";
        return;
      }
      setMessage("");
      setReady(true);
    }
    void boot();
  }, []);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const supabase = createSupabaseBrowserClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      window.location.href = "/login";
      return;
    }
    const { error } = await supabase.rpc("create_workspace", {
      workspace_name: name,
      workspace_mode: mode,
    });
    if (error) {
      setMessage(error.message);
      return;
    }
    window.location.href = "/app/email";
  }

  if (!ready) {
    return (
      <main className="wrap" style={{ padding: 48 }}>
        <p>{message}</p>
      </main>
    );
  }

  return (
    <main className="wrap" style={{ padding: 48 }}>
      <p className="kicker">First run</p>
      <h2>Name your workspace</h2>
      <form className="stack" onSubmit={onSubmit}>
        <label>
          Workspace name
          <input value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <label>
          Mode
          <select value={mode} onChange={(e) => setMode(e.target.value as "solo" | "team")}>
            <option value="solo">Solo</option>
            <option value="team">Small team</option>
          </select>
        </label>
        <button type="submit">Create workspace</button>
      </form>
      {message ? <p>{message}</p> : null}
    </main>
  );
}
