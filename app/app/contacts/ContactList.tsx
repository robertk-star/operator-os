"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type Organization = { id: string; name: string };
type Contact = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  organization_id: string | null;
  organizations?: { name: string } | { name: string }[] | null;
};

function orgName(contact: Contact) {
  const value = contact.organizations;
  if (Array.isArray(value)) return value[0]?.name;
  return value?.name;
}

export function ContactList({
  workspaceId,
  initialContacts,
  organizations,
}: {
  workspaceId: string;
  initialContacts: Contact[];
  organizations: Organization[];
}) {
  const [contacts, setContacts] = useState(initialContacts);
  const [orgs, setOrgs] = useState(organizations);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [message, setMessage] = useState("");

  async function addContact(event: FormEvent) {
    event.preventDefault();
    if (!workspaceId || !fullName.trim()) return;
    const supabase = createSupabaseBrowserClient();
    let organizationId: string | null = null;
    const trimmedOrg = organizationName.trim();

    if (trimmedOrg) {
      const existing = orgs.find((org) => org.name.toLowerCase() === trimmedOrg.toLowerCase());
      if (existing) {
        organizationId = existing.id;
      } else {
        const { data: createdOrg, error: orgError } = await supabase
          .from("organizations")
          .insert({ workspace_id: workspaceId, name: trimmedOrg })
          .select("id, name")
          .single();
        if (orgError || !createdOrg) {
          setMessage(orgError?.message || "Could not save organization.");
          return;
        }
        organizationId = createdOrg.id;
        setOrgs((current) => [...current, createdOrg]);
      }
    }

    const { data, error } = await supabase
      .from("contacts")
      .insert({
        workspace_id: workspaceId,
        organization_id: organizationId,
        full_name: fullName.trim(),
        email: email.trim() || null,
        phone: phone.trim() || null,
      })
      .select("id, full_name, email, phone, organization_id, organizations(name)")
      .single();

    if (error || !data) {
      setMessage(error?.message || "Could not save contact.");
      return;
    }

    setContacts((current) => [...current, data].sort((a, b) => a.full_name.localeCompare(b.full_name)));
    setFullName("");
    setEmail("");
    setPhone("");
    setOrganizationName("");
    setMessage("");
  }

  return (
    <div className="stack wide">
      <form className="stack" onSubmit={addContact}>
        <label>
          Name
          <input value={fullName} onChange={(e) => setFullName(e.target.value)} required placeholder="Jordan Lee" />
        </label>
        <label>
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label>
          Phone
          <input value={phone} onChange={(e) => setPhone(e.target.value)} />
        </label>
        <label>
          Organization
          <input value={organizationName} onChange={(e) => setOrganizationName(e.target.value)} placeholder="Optional" />
        </label>
        <button type="submit">Add contact</button>
      </form>
      {message ? <p>{message}</p> : null}
      <ul className="record-list">
        {contacts.length === 0 ? <li>No contacts yet.</li> : null}
        {contacts.map((contact) => (
          <li key={contact.id}>
            <div>
              <strong>{contact.full_name}</strong>
              <div className="meta">
                {[orgName(contact), contact.email, contact.phone].filter(Boolean).join(" · ") || "No details yet"}
              </div>
            </div>
            <Link href={`/app/relationships?contact=${contact.id}`}>Log interaction</Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
