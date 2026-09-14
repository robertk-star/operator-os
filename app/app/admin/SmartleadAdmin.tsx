"use client";

import { useEffect, useState } from "react";

type Account = { id: string; email: string; from_name: string; status: string; warmup_enabled: boolean; daily_limit: number | null };
type Data = {
  connection: { status: string; connectionMode: string; credentialStored: boolean; lastError: string | null } | null;
  accounts: Account[];
  mailboxSetupUrl: string;
  canManage: boolean;
};

export function SmartleadAdmin() {
  const [data, setData] = useState<Data | null>(null);
  const [mode, setMode] = useState<"managed" | "customer_owned">("customer_owned");
  const [apiKey, setApiKey] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function request(body?: Record<string, unknown>) {
    return fetch("/api/smartlead", {
      method: body ? "POST" : "GET",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async function load() {
    const response = await request();
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(result.error || "Could not load Smartlead.");
      return;
    }
    setData(result as Data);
    setMode((result.connection?.connectionMode as "managed" | "customer_owned") || "customer_owned");
  }

  useEffect(() => {
    void load();
  }, []);

  async function run(action: string, payload: Record<string, unknown> = {}) {
    setBusy(action);
    setError("");
    setNotice("");
    const response = await request({ action, ...payload });
    const result = await response.json().catch(() => ({}));
    setBusy("");
    if (!response.ok) {
      setError(result.error || "The operation failed.");
      return null;
    }
    return result;
  }

  async function connect() {
    const result = await run("configure", { connectionMode: mode, apiKey });
    if (!result) return;
    setApiKey("");
    setNotice("Smartlead connected. Connect mailboxes in Smartlead, then sync them here.");
    await load();
  }

  async function syncMailboxes() {
    const result = await run("sync_accounts");
    if (!result) return;
    setNotice(`${result.synced} mailboxes synced.`);
    await load();
  }

  async function syncReplies() {
    const result = await run("sync_replies");
    if (!result) return;
    setNotice(result.warning || "Reply sync not wired yet.");
  }

  const connected = data?.connection?.status === "connected";

  return (
    <section className="card stack">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div>
          <h3>Connect Smartlead</h3>
          <p className="meta">
            Use your own Smartlead account or a managed client. One Smartlead account can hold multiple sending mailboxes. Outbound Sequences uses this connection to deliver campaigns.
          </p>
        </div>
        {data?.connection ? <span className="badge">{data.connection.status}</span> : null}
      </div>
      <div className="form-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <button type="button" className={mode === "managed" ? "kpi-dark chip" : "chip"} onClick={() => setMode("managed")}>
          Managed by OperatorOS
        </button>
        <button type="button" className={mode === "customer_owned" ? "kpi-dark chip" : "chip"} onClick={() => setMode("customer_owned")}>
          Customer-owned Smartlead
        </button>
      </div>
      {data?.canManage ? (
        <div className="row">
          <label style={{ flex: 1 }}>
            Smartlead client API key
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={data?.connection?.credentialStored ? "Enter only to replace the stored key" : "Paste API key"}
            />
          </label>
          <button type="button" disabled={busy === "configure" || !apiKey} onClick={() => void connect()}>
            {busy === "configure" ? "Connecting..." : connected ? "Update connection" : "Connect"}
          </button>
        </div>
      ) : (
        <p className="meta">Only workspace administrators can change the Smartlead connection.</p>
      )}
      {error ? <p className="meta">{error}</p> : null}
      {notice ? <p className="meta">{notice}</p> : null}
      {connected ? (
        <div className="stack">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <div>
              <strong>Sending mailboxes</strong>
              <p className="meta">Connect Gmail, Microsoft 365, or SMTP/IMAP mailboxes in Smartlead, then synchronize them.</p>
            </div>
            <div className="row">
              <a className="chip" href={data?.mailboxSetupUrl} target="_blank" rel="noreferrer">Open Smartlead</a>
              <button type="button" className="chip" disabled={busy === "sync_replies"} onClick={() => void syncReplies()}>
                Sync replies
              </button>
              <button type="button" disabled={busy === "sync_accounts"} onClick={() => void syncMailboxes()} style={{ background: "#17243f", color: "#fff", border: 0 }}>
                {busy === "sync_accounts" ? "Syncing..." : "Sync mailboxes"}
              </button>
            </div>
          </div>
          <div className="form-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
            {(data?.accounts || []).map((account) => (
              <div key={account.id} className="card">
                <strong>{account.email}</strong>
                <p className="meta">{account.from_name || "No sender name"} · {account.status}</p>
                <p className="meta">Warmup {account.warmup_enabled ? "on" : "off"}{account.daily_limit ? ` · ${account.daily_limit}/day` : ""}</p>
              </div>
            ))}
          </div>
          {!data?.accounts?.length ? <p className="meta">No mailboxes synchronized yet.</p> : null}
        </div>
      ) : null}
    </section>
  );
}
