"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const NAV = [
  ["Gmail", "/app/email"],
  ["Calendar", "/app/calendar"],
  ["Tasks", "/app/tasks"],
  ["Priorities", "/app/priorities"],
  ["My Notes", "/app/notes"],
  ["Contacts", "/app/contacts"],
  ["Relationships", "/app/relationships"],
  ["Revenue Engine", "/app/revenue"],
  ["Outbound sequences", "/app/outbound"],
  ["Tools", "/app/tools"],
  ["Procedures", "/app/procedures"],
  ["Settings", "/app/settings"],
  ["Admin", "/app/admin"],
];

export function OperatorShell({
  workspaceName,
  children,
}: {
  workspaceName?: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.replace("/login");
  }

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="mark">O</div>
          <div>
            <h1>{workspaceName || "OperatorOS"}</h1>
            <p>Workspace</p>
          </div>
        </div>
        <button className="new-chat" type="button" onClick={() => router.push("/app/email")}>
          + New conversation
        </button>
        <nav className="nav">
          {NAV.map(([label, href]) => (
            <Link key={href} href={href} className={pathname === href ? "active" : undefined}>
              {label}
            </Link>
          ))}
        </nav>
        <button className="logout" type="button" onClick={logout}>
          Log out
        </button>
      </aside>
      <div className="workspace">{children}</div>
    </div>
  );
}
