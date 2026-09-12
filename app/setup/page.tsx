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
    supabase
      .from("workspace_members")
      .select("workspace_id")
      .limit(1)
      .then(({ data, error }) => {
        if (error) {
          setMessage(error.message);
          setReady(true);
          return;
        }
        if (data && data.length > 0) {
          window.location.href = "/app";
          return;
        }
        setMessage("");
        setReady(true);
      });
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

    const { data: workspace, error: workspaceError } = await supabase
      .from("workspaces")
      .insert({ name, mode })
      .select("id")
      .single();

    if (workspaceError || !workspace) {
      setMessage(workspaceError?.message || "Could not create workspace.");
      return;
    }

    const { error: memberError } = await supabase.from("workspace_members").insert({
      workspace_id: workspace.id,
      user_id: user.id,
      role: "owner",
    });

    if (memberError) {
      setMessage(memberError.message);
      return;
    }

    window.location.href = "/app";
  }

  if (!ready) {
    return (
      <main className="wrap">
        <p>{message}</p>
      </main>
    );
  }

  return (
    <main className="wrap">
      <p className="kicker">First run</p>
      <h1>Name your workspace</h1>
      <form className="stack" onSubmit={onSubmit}>
        <label>
          Workspace name
          <input value={name} onChange={(e) => setName(e.target.value)} required placeholder="Acme Studio" />
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
