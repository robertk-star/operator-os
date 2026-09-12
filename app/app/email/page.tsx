import { getCurrentWorkspace } from "@/lib/workspace";
import { GmailWorkspace } from "./GmailWorkspace";

export default async function EmailPage() {
  const workspace = await getCurrentWorkspace();
  return <GmailWorkspace workspaceId={workspace?.id || ""} />;
}
