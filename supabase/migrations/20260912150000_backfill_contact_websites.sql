update public.contacts c
set website = case
  when o.domain like 'http%' then o.domain
  else 'https://' || o.domain
end
from public.organizations o
where c.organization_id = o.id
  and (c.website is null or btrim(c.website) = '')
  and o.domain is not null
  and btrim(o.domain) <> '';
