"use client";

import { FormEvent, useState } from "react";

const STARTERS = [
  "Summarize any unread emails that need my attention.",
  "List emails that still need a reply.",
  "Prepare a draft reply and wait for my approval.",
];

type Turn = { role: "assistant" | "user"; text: string };

export function GmailWorkspace() {
  const [input, setInput] = useState("");
  const [turns, setTurns] = useState<Turn[]>([
    {
      role: "assistant",
      text: "Ask me to summarize unread email, find a message or conversation, explain what needs a response, or prepare an email draft for your approval.",
    },
  ]);

  function ask(text: string) {
    const prompt = text.trim();
    if (!prompt) return;
    setTurns((current) => [
      ...current,
      { role: "user", text: prompt },
      {
        role: "assistant",
        text: "Gmail is in safe mode. Inbox sync is not connected on this workspace yet, so I will not invent mail. When Google OAuth is connected, I can summarize unread mail and prepare drafts. I will not send until you approve.",
      },
    ]);
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
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about Gmail or request a draft..."
            />
            <button className="send" type="submit" aria-label="Send">
              ↑
            </button>
          </form>
          <p className="meta">Specialist handoffs and Gmail drafts require approval.</p>
        </div>
      </section>
      <aside className="rail">
        <div className="card">
          <p className="kicker">Control boundary</p>
          <p>Handoffs propose only. You approve.</p>
          <p className="meta">Research and analysis</p>
          <p className="meta">One-hop handoff proposals</p>
          <p className="meta">Email is never sent</p>
        </div>
        <div className="card">
          <p className="kicker">Current run</p>
          <p>Your next assignment will appear here.</p>
        </div>
        <div className="card">
          <p className="kicker">Available knowledge</p>
          <p className="meta">Knowledge items 0</p>
          <p className="meta">Imported notes 0</p>
          <p className="meta">Documents 0</p>
        </div>
      </aside>
    </>
  );
}
