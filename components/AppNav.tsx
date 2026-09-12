import Link from "next/link";

const links = [
  ["Home", "/app"],
  ["Tasks", "/app/tasks"],
  ["Notes", "/app/notes"],
  ["Contacts", "/app/contacts"],
  ["Revenue", "/app/revenue"],
  ["Settings", "/app/settings"],
];

export function AppNav({ current }: { current?: string }) {
  return (
    <nav className="app-nav">
      {links.map(([label, href]) => (
        <Link key={href} href={href} className={current === href ? "active" : undefined}>
          {label}
        </Link>
      ))}
    </nav>
  );
}
