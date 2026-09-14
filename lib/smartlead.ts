const SMARTLEAD_BASE_URL = "https://server.smartlead.ai/api/v1";

export async function smartleadRequest<T>(apiKey: string, path: string, init: RequestInit = {}): Promise<T> {
  const url = new URL(`${SMARTLEAD_BASE_URL}${path}`);
  url.searchParams.set("api_key", apiKey);
  const method = init.method || "GET";
  const response = await fetch(url, {
    ...init,
    headers: { "content-type": "application/json", accept: "application/json", ...(init.headers || {}) },
    cache: "no-store",
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = String((payload as { message?: string; error?: string }).message || (payload as { error?: string }).error || "");
    throw new Error((detail ? `Smartlead ${response.status} on ${method} ${path}: ${detail}` : `Smartlead ${response.status} on ${method} ${path}`).slice(0, 700));
  }
  return payload as T;
}

export function toSmartleadBody(text: string) {
  const merged = String(text || "")
    .replaceAll("[First Name]", "{{first_name}}")
    .replaceAll("[Last Name]", "{{last_name}}")
    .replaceAll("[Full Name]", "{{first_name}} {{last_name}}")
    .replaceAll("[Company]", "{{company_name}}")
    .replaceAll("[Title]", "{{title}}")
    .replaceAll("[Email]", "{{email}}");
  return merged.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>");
}
