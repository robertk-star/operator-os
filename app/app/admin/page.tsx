import { getCurrentWorkspace } from "@/lib/workspace";

export default async function AdminPage() {
  const workspace = await getCurrentWorkspace();
  return (
    <section className="main">
      <p className="kicker">Admin</p>
      <h2>Admin</h2>
      <p>Workspace: {workspace?.name}</p>
      <p className="meta">Mode: {workspace?.mode}. Role: {workspace?.role}.</p>
      <p className="meta">Member invites for team mode come next. This workspace has no SaffHire or screening defaults.</p>
    </section>
  );
}
