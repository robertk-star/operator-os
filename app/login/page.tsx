"use client";

import { FormEvent, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent, mode: "signin" | "signup") {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const supabase = createSupabaseBrowserClient();
    const redirectTo = `${window.location.origin}/auth/callback`;

    const result =
      mode === "signup"
        ? await supabase.auth.signUp({
            email,
            password,
            options: { emailRedirectTo: redirectTo },
          })
        : await supabase.auth.signInWithPassword({ email, password });

    setBusy(false);
    if (result.error) {
      setMessage(result.error.message);
      return;
    }
    if (mode === "signup") {
      setMessage("Check your email to confirm, then sign in.");
      return;
    }
    window.location.href = "/setup";
  }

  return (
    <main className="wrap">
      <p className="kicker">OperatorOS</p>
      <h1>Sign in</h1>
      <p>Create an account or sign in. Then name your workspace in the browser.</p>
      <form className="stack">
        <label>
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label>
          Password
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
        </label>
        <div className="row">
          <button type="button" disabled={busy} onClick={(e) => handleSubmit(e, "signin")}>
            Sign in
          </button>
          <button type="button" className="secondary" disabled={busy} onClick={(e) => handleSubmit(e, "signup")}>
            Create account
          </button>
        </div>
      </form>
      {message ? <p>{message}</p> : null}
    </main>
  );
}
