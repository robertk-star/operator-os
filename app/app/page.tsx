import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const modules = [
  ["Tasks", "/app/tasks"],
  ["Notes", "/app/notes"],
  ["Email", "/app/email"],
  ["Calendar", "/app/calendar"],
  ["Contacts", "/app/contacts"],
  ["Relationships", "/app/relationships"],
  ["Revenue", "/app/revenue"],
  ["Settings", "/app/settings"],
  ["Admin", "/app/admin"],
];

export default async function AppHomePage() {
  const supabase = await createSupabaseServerClient();
  const { data: memberships } = await supabase
    .from("workspace_members")
    .select("role, workspaces(name, mode)")
    .limit(1);

  const row = memberships?.[0] as
    | { role: string; workspaces: { name: string; mode: string } | { name: string; mode: string }[] | null }
    | undefined;
  const workspace = Array.isArray(row?.workspaces) ? row.workspaces[0] : row?.workspaces;

  return (
    <main className="wrap">
      <p className="kicker">Workspace</p>
      <h1>{workspace?.name || "OperatorOS"}</h1>
      <p>
        Mode: {workspace?.mode || "unknown"}. Role: {row?.role || "member"}.
      </p>
      <ul className="modules">
        {modules.map(([label, href]) => (
          <li key={href}>
            <Link href={href}>{label}</Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
