"use client";

import { FormEvent, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { GOOGLE_USER_SCOPES } from "@/lib/googleAuth";

const STARTERS = [
  "Summarize any unread emails that need my attention.",
  "List emails that still need a reply.",
  "Prepare a draft reply and wait for my approval.",
];

type Turn = { role: "assistant" | "user"; text: string };

export function GmailWorkspace({ workspaceId }: { workspaceId: string }) {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState("disconnected");
  const [email, setEmail] = useState("");
  const [input, setInput] = useState("");
  const [turns, setTurns] = useState<Turn[]>([
    {
      role: "assistant",
      text: "Ask me to summarize unread email, find a message, or prepare a draft for your approval.",
    },
  ]);

  useEffect(() => {
    if (!workspaceId) return;
    const supabase = createSupabaseBrowserClient();
    supabase
      .from("integrations")
      .select("status, metadata")
      .eq("workspace_id", workspaceId)
      .eq("provider", "gmail")
      .maybeSingle()
      .then(({ data }) => {
        if (data?.status) setStatus(data.status);
        const meta = data?.metadata as { email?: string } | null;
        if (meta?.email) setEmail(meta.email);
      });
  }, [workspaceId, searchParams]);

  async function addGmail() {
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=/app/email`,
        scopes: GOOGLE_USER_SCOPES,
        queryParams: { access_type: "offline", prompt: "select_account" },
      },
    });
    if (error) setTurns((current) => [...current, { role: "assistant", text: error.message }]);
  }

  function ask(text: string) {
    const prompt = text.trim();
    if (!prompt) return;
    const reply =
      status === "connected"
        ? `Gmail is connected${email ? ` as ${email}` : ""}. Inbox listing is next. I will not send mail without your approval.`
        : "Add Gmail first. You will sign in with your Google account. You do not need a developer console.";
    setTurns((current) => [...current, { role: "user", text: prompt }, { role: "assistant", text: reply }]);
    setInput("");
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    ask(input);
  }

  return (
    <>
      <section className="main">
        <p className="kicker">
          Gmail <span className="badge">Safe mode</span>
        </p>
        <h2>Gmail</h2>
        <p className="meta">Add a Gmail address by signing in with Google. Drafts only. Nothing is sent until you approve.</p>
        <div className="thread">
          {turns.map((turn, index) => (
            <div key={index} className="bubble">
              <p className="kicker">{turn.role === "assistant" ? "Gmail assistant" : "You"}</p>
              <p>{turn.text}</p>
            </div>
          ))}
          <div className="chips">
            {STARTERS.map((item) => (
              <button key={item} className="chip" type="button" onClick={() => ask(item)}>
                {item}
              </button>
            ))}
          </div>
          <form className="composer" onSubmit={onSubmit}>
            <textarea value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask about Gmail or request a draft..." />
            <button className="send" type="submit" aria-label="Send">
              ↑
            </button>
          </form>
        </div>
      </section>
      <aside className="rail">
        <div className="card">
          <p className="kicker">Gmail account</p>
          <p>{status === "connected" ? email || "Connected" : "No Gmail connected."}</p>
          <button type="button" className="chip" onClick={addGmail}>
            {status === "connected" ? "Use a different Gmail" : "Add Gmail"}
          </button>
        </div>
        <div className="card">
          <p className="kicker">Control boundary</p>
          <p>People only sign in with Google. They do not configure OAuth.</p>
        </div>
      </aside>
    </>
  );
}
