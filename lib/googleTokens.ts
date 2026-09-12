import { getGoogleOAuthConfig } from "./google";

type IntegrationRow = {
  metadata: {
    access_token?: string;
    refresh_token?: string;
    provider_refresh_token?: string;
    expiry?: number;
    email?: string;
  } | null;
};

export async function refreshGoogleAccessToken(refreshToken: string) {
  const { clientId, clientSecret } = getGoogleOAuthConfig();
  if (!clientId || !clientSecret) return null;
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!response.ok) return null;
  return (await response.json()) as { access_token: string; expires_in: number };
}

export async function getGmailIntegrationToken(
  supabase: { from: (table: string) => any },
  workspaceId: string
) {
  const { data } = await supabase
    .from("integrations")
    .select("metadata, status")
    .eq("workspace_id", workspaceId)
    .eq("provider", "gmail")
    .maybeSingle();
  if (!data || data.status !== "connected") return { token: null, email: null, refresh: null as string | null };
  const metadata = (data as IntegrationRow).metadata || {};
  return {
    token: metadata.access_token || null,
    email: metadata.email || null,
    refresh: metadata.refresh_token || metadata.provider_refresh_token || null,
  };
}
