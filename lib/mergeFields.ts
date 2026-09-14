export const MERGE_FIELDS = [
  ["[First Name]", "first_name"],
  ["[Last Name]", "last_name"],
  ["[Full Name]", "full_name"],
  ["[Company]", "company"],
  ["[Title]", "title"],
  ["[Email]", "email"],
] as const;

export function mergeFields(
  text: string,
  person: {
    first_name?: string | null;
    last_name?: string | null;
    full_name?: string | null;
    business_name?: string | null;
    job_title?: string | null;
    email?: string | null;
  }
) {
  const first = String(person.first_name || "").trim();
  const last = String(person.last_name || "").trim();
  const full = [first, last].filter(Boolean).join(" ") || String(person.full_name || "").trim();
  const values: Record<string, string> = {
    "[First Name]": first,
    "[Last Name]": last,
    "[Full Name]": full,
    "[Company]": String(person.business_name || "").trim(),
    "[Title]": String(person.job_title || "").trim(),
    "[Email]": String(person.email || "").trim(),
    "{{first_name}}": first,
    "{{last_name}}": last,
    "{{full_name}}": full,
    "{{company}}": String(person.business_name || "").trim(),
    "{{title}}": String(person.job_title || "").trim(),
    "{{email}}": String(person.email || "").trim(),
  };
  return Object.entries(values).reduce((current, [token, value]) => current.split(token).join(value), text || "");
}
