import Link from "next/link";
import { AppNav } from "@/components/AppNav";
import { getCurrentWorkspace } from "@/lib/workspace";

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
  const workspace = await getCurrentWorkspace();

  return (
    <main className="wrap">
      <AppNav current="/app" />
      <p className="kicker">Workspace</p>
      <h1>{workspace?.name || "OperatorOS"}</h1>
      <p>
        Mode: {workspace?.mode || "unknown"}. Role: {workspace?.role || "member"}.
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
