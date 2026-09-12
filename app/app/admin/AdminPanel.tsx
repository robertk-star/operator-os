"use client";

import { FormEvent, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type Member = { id: string; role: string; user_id: string; created_at: string };
type Invite = { id: string; email: string; role: string; accepted_at: string | null; created_at: string };

export function AdminPanel({
  workspaceId,
  canInvite,
  members,
  invites,
}: {
  workspaceId: string;
  canInvite: boolean;
  members: Member[];
  invites: Invite[];
}) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("member");
  const [pending, setPending] = useState(invites);
  const [message, setMessage] = useState("");

  async function invite(event: FormEvent) {
    event.preventDefault();
    const supabase = createSupabaseBrowserClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from("workspace_invites")
      .insert({
        workspace_id: workspaceId,
        email: email.trim().toLowerCase(),
        role,
        invited_by: user?.id ?? null,
      })
      .select("id, email, role, accepted_at, created_at")
      .single();
    if (error || !data) {
      setMessage(error?.message || "Could not create invite. Run the Admin SQL migration if this table is missing.");
      return;
    }
    setPending((current) => [data, ...current]);
    setEmail("");
    setMessage("Invite saved. They join this workspace the next time they sign in with that email.");
  }

  return (
    <div className="stack wide">
      <div className="card">
        <p className="kicker">Members</p>
        <ul className="record-list">
          {members.map((member) => (
            <li key={member.id}>
              <div>
                <strong>{member.role}</strong>
                <div className="meta">{member.user_id}</div>
              </div>
            </li>
          ))}
        </ul>
      </div>
      {canInvite ? (
        <form className="stack" onSubmit={invite}>
          <label>
            Invite email
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>
          <label>
            Role
            <select value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </select>
          </label>
          <button type="submit">Send invite</button>
        </form>
      ) : (
        <p className="meta">Invites are available in team mode for owners and admins.</p>
      )}
      {message ? <p>{message}</p> : null}
      <div className="card">
        <p className="kicker">Invites</p>
        <ul className="record-list">
          {pending.length === 0 ? <li>No invites yet.</li> : null}
          {pending.map((inviteRow) => (
            <li key={inviteRow.id}>
              <div>
                <strong>{inviteRow.email}</strong>
                <div className="meta">
                  {inviteRow.role} · {inviteRow.accepted_at ? "accepted" : "pending"}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
