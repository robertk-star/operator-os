"use client";

import { FormEvent, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const STARTERS = [
  "Summarize any unread emails that need my attention.",
  "List emails that still need a reply.",
  "Prepare a draft reply and wait for my approval.",
];

type Turn = { role: "assistant" | "user"; text: string };

export function GmailWorkspace({ workspaceId }: { workspaceId: string }) {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState("disconnected");
  const [input, setInput] = useState("");
  const [turns, setTurns] = useState<Turn[]>([
    {
      role: "assistant",
      text: "Ask me to summarize unread email, find a message or conversation, explain what needs a response, or prepare an email draft for your approval.",
    },
  ]);

  useEffect(() => {
    const flag = searchParams.get("google");
    if (flag === "connected") setStatus("connected");
    if (flag === "denied") setStatus("denied");
    if (flag === "token_failed") setStatus("token_failed");
    if (!workspaceId) return;
    const supabase = createSupabaseBrowserClient();
    supabase
      .from("integrations")
      .select("status")
      .eq("workspace_id", workspaceId)
      .eq("provider", "gmail")
      .maybeSingle()
      .then(({ data }) => {
        if (data?.status) setStatus(data.status);
      });
  }, [workspaceId, searchParams]);

  function ask(text: string) {
    const prompt = text.trim();
    if (!prompt) return;
    const reply =
      status === "connected"
        ? "Google is connected in safe mode. Inbox listing is the next wiring step. I still will not send mail without your approval."
        : "Gmail is not connected. Use Connect Gmail. That starts Google OAuth. Until keys are in Vercel, the connect route will tell you what is missing.";
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
        <p className="meta">Ask questions about your inbox and prepare drafts. Email is never sent until you approve.</p>
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
          <p className="kicker">Gmail connection</p>
          <p>
            {status === "connected"
              ? "Connected. Inbox sync methods come next."
              : status === "denied"
                ? "Google access was denied."
                : status === "token_failed"
                  ? "Token exchange failed. Check Vercel Google env vars."
                  : "Not connected."}
          </p>
          <a className="chip" href="/api/google/start">
            Connect Gmail
          </a>
        </div>
        <div className="card">
          <p className="kicker">Control boundary</p>
          <p>Drafts only. No gmail.send scope.</p>
        </div>
      </aside>
    </>
  );
}
