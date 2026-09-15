"use client";

import { useState } from "react";
import { CompanyLeadSync } from "./CompanyLeadSync";
import { ContactsDesk } from "./ContactsDesk";

export function ContactsDeskHost({ workspaceId, initialContacts }: { workspaceId: string; initialContacts: any[] }) {
  const [contacts, setContacts] = useState(initialContacts);
  return (
    <>
      <CompanyLeadSync workspaceId={workspaceId} onLoad={(rows) => setContacts(rows as typeof initialContacts)} />
      <ContactsDesk key={contacts.map((item) => `${item.id}:${item.status}`).join("|").slice(0, 400)} workspaceId={workspaceId} initialContacts={contacts} />
    </>
  );
}
