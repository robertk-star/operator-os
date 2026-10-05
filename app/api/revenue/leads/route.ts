  const organizations = payload.organizations || payload.accounts || [];
  const mapped = organizations.map((org: any) => {
    const site = org.website_url || org.primary_domain || "";
    const employees = org.estimated_num_employees || org.organization_headcount_six_month_growth || "";
    const headcount = employees ? `${Number(org.estimated_num_employees || 0).toLocaleString()} employees` : "";
    return {
      id: org.id || org.organization_id || "",
      name: org.name || "Unknown company",
      url: site,
      domain: domainOf(site || org.primary_domain || ""),
      employees: org.estimated_num_employees ? String(org.estimated_num_employees) : "",
      snippet: [headcount, org.industry, org.short_description].filter(Boolean).join(" \u00b7 "),
      industry: org.industry || "",
      source: "apollo",
    };
  });