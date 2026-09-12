"use client";

import { FormEvent, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { GOOGLE_USER_SCOPES } from "@/lib/googleAuth";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function continueWithGoogle() {
    setBusy(true);
    setMessage("");
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=/setup`,
        scopes: GOOGLE_USER_SCOPES,
        queryParams: { access_type: "offline", prompt: "select_account" },
      },
    });
    if (error) {
      setBusy(false);
      setMessage(error.message);
    }
  }

  async function handleSubmit(event: FormEvent, mode: "signin" | "signup") {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const supabase = createSupabaseBrowserClient();
    const redirectTo = `${window.location.origin}/auth/callback`;
    const result =
      mode === "signup"
        ? await supabase.auth.signUp({ email, password, options: { emailRedirectTo: redirectTo } })
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
    <main className="wrap" style={{ padding: 48 }}>
      <p className="kicker">OperatorOS</p>
      <h2>Sign in</h2>
      <p className="meta">Use your Gmail account. You will see Google's normal sign-in screen. You do not set up developer access.</p>
      <button type="button" disabled={busy} onClick={continueWithGoogle}>
        Continue with Google
      </button>
      <p className="meta">Or use email and password</p>
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
