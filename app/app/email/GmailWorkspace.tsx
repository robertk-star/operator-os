"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { GOOGLE_USER_SCOPES } from "@/lib/googleAuth";

type MailItem = { id: string; subject: string; from: string; date: string; snippet: string };
type Turn = { role: "assistant" | "user"; text: string };
type Draft = { to: string; subject: string; text: string };

function formatList(items: MailItem[], empty: string) {
  if (!items.length) return empty;
  return items
    .slice(0, 8)
    .map((item, index) => `${index + 1}. ${item.subject}\n    ${item.from}\n    ${item.snippet}`)
    .join("\n\n");
}

function emailFrom(from: string) {
  const match = from.match(/<([^>]+)>/);
  return match ? match[1] : from;
}

export function GmailWorkspace({ workspaceId }: { workspaceId: string }) {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState("disconnected");
  const [email, setEmail] = useState("");
  const [unread, setUnread] = useState<MailItem[]>([]);
  const [reply, setReply] = useState<MailItem[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [error, setError] = useState("");
  const [input, setInput] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [draftStatus, setDraftStatus] = useState("");
  const [turns, setTurns] = useState<Turn[]>([
    {
      role: "assistant",
      text: "Select an email on the right, then prepare a draft. Nothing is sent until you approve.",
    },
  ]);

  useEffect(() => {
    fetch("/api/gmail/messages")
      .then((response) => response.json())
      .then((payload) => {
        setStatus(payload.connected ? "connected" : "disconnected");
        setEmail(payload.email || "");
        const nextUnread = payload.unread || [];
        const nextReply = payload.reply || [];
        setUnread(nextUnread);
        setReply(nextReply);
        setError(payload.error || "");
        const first = nextUnread[0] || nextReply[0];
        if (first) setSelectedId(first.id);
      })
      .catch(() => setError("Could not reach Gmail."));
  }, [workspaceId, searchParams]);

  const mailbox = useMemo(() => {
    const seen = new Set<string>();
    return [...unread, ...reply].filter((item) => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });
  }, [unread, reply]);

  const selected = mailbox.find((item) => item.id === selectedId) || null;

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

  function makeDraft(item: MailItem): Draft {
    return {
      to: emailFrom(item.from),
      subject: item.subject.startsWith("Re:") ? item.subject : `Re: ${item.subject}`,
      text: `Thank you for your note.\n\nI will follow up with a complete reply shortly.`,
    };
  }

  function prepareDraft(item: MailItem | null) {
    if (!item) {
      setTurns((current) => [...current, { role: "assistant", text: "Select an email first." }]);
      return;
    }
    const next = makeDraft(item);
    setDraft(next);
    setTurns((current) => [
      ...current,
      { role: "user", text: `Prepare a draft for: ${item.subject}` },
      { role: "assistant", text: `Draft ready for ${item.from}. Edit it below, then save to Gmail Drafts. It will not send.` },
    ]);
  }

  function answer(prompt: string) {
    const text = prompt.toLowerCase();
    if (status !== "connected") return "Add Gmail first. Sign in with your Google account.";
    if (text.includes("unread") || text.includes("attention")) return formatList(unread, "No unread inbox threads.");
    if (text.includes("reply") || text.includes("respond")) return formatList(reply, "No recent inbox mail to review.");
    if (text.includes("draft")) {
      prepareDraft(selected);
      return selected ? `Using ${selected.subject}` : "Select an email first.";
    }
    return selected ? `${selected.subject}\n${selected.from}\n${selected.snippet}` : formatList(unread, "Select an email, then prepare a draft.");
  }

  function ask(text: string) {
    const prompt = text.trim();
    if (!prompt) return;
    if (prompt.toLowerCase().includes("draft")) {
      prepareDraft(selected);
      setInput("");
      return;
    }
    setTurns((current) => [...current, { role: "user", text: prompt }, { role: "assistant", text: answer(prompt) }]);
    setInput("");
  }

  async function approveDraft() {
    if (!draft) return;
    setDraftStatus("Saving draft in Gmail...");
    const response = await fetch("/api/gmail/drafts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draft),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      setDraftStatus(payload.error || "Could not save draft.");
      return;
    }
    setDraftStatus("Draft saved in Gmail. It was not sent.");
    setTurns((current) => [...current, { role: "assistant", text: `Draft saved to ${draft.to}. It was not sent.` }]);
    setDraft(null);
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
            ? `${email || "Gmail connected"}. Select a message, then prepare a draft.`
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
          {draft ? (
            <form
              className="stack"
              onSubmit={(event) => {
                event.preventDefault();
                void approveDraft();
              }}
            >
              <p className="kicker">Edit draft</p>
              <label>
                To
                <input value={draft.to} onChange={(e) => setDraft({ ...draft, to: e.target.value })} />
              </label>
              <label>
                Subject
                <input value={draft.subject} onChange={(e) => setDraft({ ...draft, subject: e.target.value })} />
              </label>
              <label>
                Body
                <textarea className="field" rows={6} value={draft.text} onChange={(e) => setDraft({ ...draft, text: e.target.value })} />
              </label>
              <button type="submit">Save draft in Gmail</button>
              <button type="button" className="chip" onClick={() => setDraft(null)}>
                Discard
              </button>
            </form>
          ) : null}
          {draftStatus ? <p className="meta">{draftStatus}</p> : null}
          <div className="chips">
            <button className="chip" type="button" onClick={() => ask("Summarize unread")}>
              Summarize unread
            </button>
            <button className="chip" type="button" onClick={() => prepareDraft(selected)}>
              Draft selected email
            </button>
          </div>
          <form className="composer" onSubmit={onSubmit}>
            <textarea value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask about the selected email..." />
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
          <p className="kicker">Inbox</p>
          <div className="mail-picker">
            {mailbox.length === 0 ? <p className="meta">No messages loaded.</p> : null}
            {mailbox.map((item) => (
              <button
                key={item.id}
                type="button"
                className={item.id === selectedId ? "mail-item selected" : "mail-item"}
                onClick={() => {
                  setSelectedId(item.id);
                  setDraft(null);
                }}
              >
                <strong>{item.subject}</strong>
                <span>{item.from}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="card">
          <p className="kicker">Control boundary</p>
          <p>You pick the email. You approve the draft. Nothing is sent.</p>
        </div>
      </aside>
    </>
  );
}
