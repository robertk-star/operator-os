"use client";

import { FormEvent, useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const STARTERS = [
  "Summarize any unread emails that need my attention.",
  "List emails that still need a reply.",
  "Prepare a draft reply and wait for my approval.",
];

type Turn = { role: "assistant" | "user"; text: string };

export function GmailWorkspace({ workspaceId }: { workspaceId: string }) {
  const [connected, setConnected] = useState(false);
  const [input, setInput] = useState("");
  const [turns, setTurns] = useState<Turn[]>([
    {
      role: "assistant",
      text: "Ask me to summarize unread email, find a message or conversation, explain what needs a response, or prepare an email draft for your approval.",
    },
  ]);

  useEffect(() => {
    if (!workspaceId) return;
    const supabase = createSupabaseBrowserClient();
    supabase
      .from("integrations")
      .select("status")
      .eq("workspace_id", workspaceId)
      .eq("provider", "gmail")
      .maybeSingle()
      .then(({ data }) => setConnected(data?.status === "connected" || data?.status === "pending"));
  }, [workspaceId]);

  async function markConnect() {
    if (!workspaceId) return;
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.from("integrations").upsert(
      { workspace_id: workspaceId, provider: "gmail", status: "pending", metadata: { requested_at: new Date().toISOString() } },
      { onConflict: "workspace_id,provider" }
    );
    if (!error) setConnected(true);
  }

  function ask(text: string) {
    const prompt = text.trim();
    if (!prompt) return;
    const reply = connected
      ? "Safe mode is on. Gmail OAuth keys are not in this OperatorOS project yet, so I will not invent inbox contents or send mail. I can prepare a draft from what you type. Nothing is sent until you approve."
      : "Gmail is not connected. Use Connect Gmail in the right rail. Until OAuth is live I will not invent mail or send anything.";
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
        <p className="meta">Ask questions about your inbox and prepare drafts without leaving OperatorOS. Email is never sent until you approve.</p>
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
          <p>{connected ? "Connect requested. Add Google OAuth keys in Vercel to finish inbox sync." : "Not connected."}</p>
          {!connected ? (
            <button type="button" className="chip" onClick={markConnect}>
              Connect Gmail
            </button>
          ) : null}
        </div>
        <div className="card">
          <p className="kicker">Control boundary</p>
          <p>Handoffs propose only. You approve.</p>
          <p className="meta">Email is never sent</p>
        </div>
      </aside>
    </>
  );
}
