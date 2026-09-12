"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { GOOGLE_USER_SCOPES } from "@/lib/googleAuth";

type MailItem = { id: string; subject: string; from: string; date: string; snippet: string };
type Turn = { role: "assistant" | "user"; text: string };
type Draft = { to: string; subject: string; text: string };

function emailFrom(from: string) {
  const match = from.match(/<([^>]+)>/);
  return match ? match[1] : from;
}

function searchQueryFromPrompt(prompt: string) {
  return prompt
    .replace(/find( an)? emails?/gi, " ")
    .replace(/containing/gi, " ")
    .replace(/about/gi, " ")
    .replace(/search( for)?/gi, " ")
    .replace(/show me/gi, " ")
    .replace(/please/gi, " ")
    .replace(/\bin\b/gi, " ")
    .replace(/\bit\b/gi, " ")
    .replace(/\bwith\b/gi, " ")
    .replace(/\ban\b/gi, " ")
    .replace(/\bthe\b/gi, " ")
    .trim();
}

export function GmailWorkspace({ workspaceId }: { workspaceId: string }) {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState("disconnected");
  const [email, setEmail] = useState("");
  const [unread, setUnread] = useState<MailItem[]>([]);
  const [reply, setReply] = useState<MailItem[]>([]);
  const [results, setResults] = useState<MailItem[]>([]);
  const [resultLabel, setResultLabel] = useState("No search yet");
  const [selectedId, setSelectedId] = useState("");
  const [error, setError] = useState("");
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [compose, setCompose] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [draftStatus, setDraftStatus] = useState("");
  const [turns, setTurns] = useState<Turn[]>([
    {
      role: "assistant",
      text: "Ask me to summarize unread email, search for a word like SPXC, or draft a new email. Results appear on the right.",
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

  const selected = results.find((item) => item.id === selectedId) || null;

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

  function showResults(label: string, items: MailItem[], userText: string) {
    setResults(items);
    setResultLabel(label);
    setSelectedId("");
    setCompose(false);
    setDraft(null);
    const summary = items.length
      ? items.map((item, index) => `${index + 1}. ${item.subject}\n    ${item.from}\n    ${item.snippet}`).join("\n\n")
      : "No matching email.";
    setTurns((current) => [
      ...current,
      { role: "user", text: userText },
      { role: "assistant", text: `${summary}\n\nSelect one on the right to reply.` },
    ]);
  }

  async function searchMail(prompt: string) {
    const query = searchQueryFromPrompt(prompt) || prompt;
    setBusy(true);
    setTurns((current) => [...current, { role: "user", text: prompt }, { role: "assistant", text: `Searching Gmail for ${query}...` }]);
    const response = await fetch(`/api/gmail/search?q=${encodeURIComponent(query)}`);
    const payload = await response.json().catch(() => ({}));
    setBusy(false);
    const items = payload.items || [];
    setResults(items);
    setResultLabel(`Search: ${query}`);
    setSelectedId("");
    const summary = items.length
      ? items.map((item: MailItem, index: number) => `${index + 1}. ${item.subject}\n    ${item.from}\n    ${item.snippet}`).join("\n\n")
      : payload.error || `No Gmail results for ${query}.`;
    setTurns((current) => [...current, { role: "assistant", text: `${summary}\n\nSelect one on the right to reply.` }]);
  }

  function replyTo(item: MailItem) {
    setSelectedId(item.id);
    setCompose(false);
    setDraft({
      to: emailFrom(item.from),
      subject: item.subject.startsWith("Re:") ? item.subject : `Re: ${item.subject}`,
      text: "",
    });
    setTurns((current) => [
      ...current,
      { role: "user", text: `Reply to ${item.subject}` },
      { role: "assistant", text: "Write what you want to say, then save the draft to Gmail. It will not send." },
    ]);
  }

  function startNewEmail() {
    setCompose(true);
    setSelectedId("");
    setDraft({ to: "", subject: "", text: "" });
    setTurns((current) => [
      ...current,
      { role: "user", text: "Draft an email" },
      { role: "assistant", text: "Who is this to, and what do you want to say? Fill in the draft form." },
    ]);
  }

  function ask(text: string) {
    const prompt = text.trim();
    if (!prompt || busy) return;
    const lower = prompt.toLowerCase();
    if (status !== "connected") {
      setTurns((current) => [...current, { role: "user", text: prompt }, { role: "assistant", text: "Add Gmail first." }]);
      return;
    }
    if (lower.includes("unread") || lower.includes("attention")) {
      showResults("Unread", unread, prompt);
      setInput("");
      return;
    }
    if (lower.includes("need") && lower.includes("reply")) {
      showResults("Needs a reply", reply, prompt);
      setInput("");
      return;
    }
    if (lower.includes("draft") && selected) {
      replyTo(selected);
      setInput("");
      return;
    }
    if (lower.includes("draft an email") || (lower.includes("draft") && !selected && (lower.includes("new") || lower.includes("send")))) {
      startNewEmail();
      setInput("");
      return;
    }
    void searchMail(prompt);
    setInput("");
  }

  async function approveDraft() {
    if (!draft || !draft.to.trim() || !draft.text.trim()) {
      setDraftStatus("Add who it is to and what you want to say.");
      return;
    }
    const payloadDraft = { ...draft, subject: draft.subject.trim() || "(No subject)" };
    setDraftStatus("Saving draft in Gmail...");
    const response = await fetch("/api/gmail/drafts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payloadDraft),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      setDraftStatus(payload.error || "Could not save draft.");
      return;
    }
    setDraftStatus("Draft saved in Gmail. It was not sent.");
    setTurns((current) => [...current, { role: "assistant", text: `Draft saved to ${payloadDraft.to}. It was not sent.` }]);
    setDraft(null);
    setCompose(false);
  }

  return (
    <>
      <section className="main">
        <p className="kicker">
          Gmail <span className="badge">Safe mode</span>
        </p>
        <h2>Gmail</h2>
        <p className="meta">
          {status === "connected" ? `${email || "Gmail connected"}. ${unread.length} unread.` : "Add Gmail to read your inbox here."}
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
              <p className="kicker">{compose ? "New email" : "Reply draft"}</p>
              <label>
                To
                <input value={draft.to} onChange={(e) => setDraft({ ...draft, to: e.target.value })} required placeholder="who is this to?" />
              </label>
              <label>
                Subject
                <input value={draft.subject} onChange={(e) => setDraft({ ...draft, subject: e.target.value })} placeholder="optional" />
              </label>
              <label>
                What do you want to say?
                <textarea className="field" rows={6} value={draft.text} onChange={(e) => setDraft({ ...draft, text: e.target.value })} required />
              </label>
              <button type="submit">Save draft in Gmail</button>
              <button type="button" className="chip" onClick={() => { setDraft(null); setCompose(false); }}>
                Discard
              </button>
            </form>
          ) : null}
          {draftStatus ? <p className="meta">{draftStatus}</p> : null}
          <div className="chips">
            <button className="chip" type="button" onClick={() => ask("Summarize unread emails")}>
              Summarize unread
            </button>
            <button className="chip" type="button" onClick={startNewEmail}>
              Draft an email
            </button>
          </div>
          <form
            className="composer"
            onSubmit={(event) => {
              event.preventDefault();
              ask(input);
            }}
          >
            <textarea value={input} onChange={(e) => setInput(e.target.value)} placeholder="Find emails containing SPXC" />
            <button className="send" type="submit" aria-label="Send" disabled={busy}>
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
          <p className="kicker">{resultLabel}</p>
          {results.length === 0 ? <p className="meta">Run a search to fill this list.</p> : null}
          {results.map((item) => (
            <button
              key={item.id}
              type="button"
              className={item.id === selectedId ? "mail-item selected" : "mail-item"}
              onClick={() => replyTo(item)}
            >
              <strong>{item.subject}</strong>
              <span>{item.from}</span>
            </button>
          ))}
        </div>
      </aside>
    </>
  );
}
