"use client";

import { FormEvent, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { GOOGLE_USER_SCOPES } from "@/lib/googleAuth";

type MailItem = { id: string; subject: string; from: string; date: string; snippet: string; unread?: boolean };
type Turn = { role: "assistant" | "user"; text: string };

function formatList(items: MailItem[], empty: string) {
  if (!items.length) return empty;
  return items
    .slice(0, 8)
    .map((item, index) => `${index + 1}. ${item.subject}\n    ${item.from}\n    ${item.snippet}`)
    .join("\n\n");
}

export function GmailWorkspace({ workspaceId }: { workspaceId: string }) {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState("disconnected");
  const [email, setEmail] = useState("");
  const [unread, setUnread] = useState<MailItem[]>([]);
  const [reply, setReply] = useState<MailItem[]>([]);
  const [error, setError] = useState("");
  const [input, setInput] = useState("");
  const [turns, setTurns] = useState<Turn[]>([
    {
      role: "assistant",
      text: "Ask me to summarize unread email, find a message, or prepare a draft for your approval.",
    },
  ]);

  useEffect(() => {
    fetch("/api/gmail/messages")
      .then((response) => response.json())
      .then((payload) => {
        setStatus(payload.connected ? "connected" : "disconnected");
        setEmail(payload.email || "");
        setUnread(payload.unread || []);
        setReply(payload.reply || []);
        setError(payload.error || "");
      })
      .catch(() => setError("Could not reach Gmail."));
  }, [workspaceId, searchParams]);

  async function addGmail() {
    const supabase = createSupabaseBrowserClient();
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=/app/email`,
        scopes: GOOGLE_USER_SCOPES,
        queryParams: { access_type: "offline", prompt: "select_account" },
      },
    });
    if (oauthError) setTurns((current) => [...current, { role: "assistant", text: oauthError.message }]);
  }

  function answer(prompt: string) {
    const text = prompt.toLowerCase();
    if (status !== "connected") {
      return "Add Gmail first. Sign in with your Google account. You do not need a developer console.";
    }
    if (text.includes("unread") || text.includes("attention")) {
      return formatList(unread, "No unread mail in the last 21 days.");
    }
    if (text.includes("reply") || text.includes("respond")) {
      return formatList(reply, "No recent inbox mail to review.");
    }
    if (text.includes("draft")) {
      const first = unread[0] || reply[0];
      if (!first) return "There is nothing to draft against yet.";
      return `Draft ready for approval. Nothing will be sent.\n\nTo: ${first.from}\nSubject: Re: ${first.subject}\n\nThank you for your note. I will follow up with a complete reply shortly.\n\nApprove this in a later step before anything leaves Gmail.`;
    }
    const haystack = [...unread, ...reply];
    const match = haystack.find((item) => text.split(" ").some((word) => word.length > 3 && (item.subject.toLowerCase().includes(word) || item.from.toLowerCase().includes(word) || item.snippet.toLowerCase().includes(word))));
    if (match) {
      return `${match.subject}\n${match.from}\n${match.snippet}`;
    }
    return formatList(unread, "Connected. Ask me to summarize unread mail or list what needs a reply.");
  }

  function ask(text: string) {
    const prompt = text.trim();
    if (!prompt) return;
    setTurns((current) => [...current, { role: "user", text: prompt }, { role: "assistant", text: answer(prompt) }]);
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
        <p className="meta">
          {status === "connected"
            ? `${email || "Gmail connected"}. ${unread.length} unread. Drafts only.`
            : "Add Gmail to read your inbox here."}
        </p>
        {error ? <p className="meta">{error}</p> : null}
        <div className="thread">
          {turns.map((turn, index) => (
            <div key={index} className="bubble">
              <p className="kicker">{turn.role === "assistant" ? "Gmail assistant" : "You"}</p>
              <pre className="mail-pre">{turn.text}</pre>
            </div>
          ))}
          <div className="chips">
            <button className="chip" type="button" onClick={() => ask("Summarize any unread emails that need my attention.")}>
              Summarize unread
            </button>
            <button className="chip" type="button" onClick={() => ask("List emails that still need a reply.")}>
              Needs a reply
            </button>
            <button className="chip" type="button" onClick={() => ask("Prepare a draft reply and wait for my approval.")}>
              Prepare a draft
            </button>
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
          <p className="kicker">Unread</p>
          <p>{unread.length}</p>
        </div>
        <div className="card">
          <p className="kicker">Control boundary</p>
          <p>Reads inbox. Prepares drafts. Does not send.</p>
        </div>
      </aside>
    </>
  );
}
