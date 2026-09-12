import { OperatorShell } from "@/components/OperatorShell";
import { getCurrentWorkspace } from "@/lib/workspace";

export default async function SignedInLayout({ children }: { children: React.ReactNode }) {
  const workspace = await getCurrentWorkspace();
  return <OperatorShell workspaceName={workspace?.name}>{children}</OperatorShell>;
}
