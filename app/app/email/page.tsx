import { Suspense } from "react";
import { getCurrentWorkspace } from "@/lib/workspace";
import { GmailWorkspace } from "./GmailWorkspace";

export default async function EmailPage() {
  const workspace = await getCurrentWorkspace();
  return (
    <Suspense fallback={<section className="main"><p>Loading Gmail...</p></section>}>
      <GmailWorkspace workspaceId={workspace?.id || ""} />
    </Suspense>
  );
}
