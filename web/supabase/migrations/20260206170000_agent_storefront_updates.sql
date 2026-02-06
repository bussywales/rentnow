-- Product updates for storefront and contact improvements.

insert into public.product_updates (title, summary, body, audience, published_at, source_ref)
values
  (
    'Agent storefronts upgraded',
    'New storefront hero, listing filters, and premium empty states make it easier to browse an agent''s inventory.',
    'Agent storefronts now highlight the agent profile, active listings count, smarter filters, and a richer empty state for better discovery.',
    'tenant',
    now(),
    'agent-storefronts-upgrade-20260206'
  ),
  (
    'Agent storefronts upgraded',
    'New storefront hero, listing filters, and premium empty states make it easier to browse an agent''s inventory.',
    'Agent storefronts now highlight the agent profile, active listings count, smarter filters, and a richer empty state for better discovery.',
    'host',
    now(),
    'agent-storefronts-upgrade-20260206'
  ),
  (
    'Agent storefronts upgraded',
    'New storefront hero, listing filters, and premium empty states make it easier to browse an agent''s inventory.',
    'Agent storefronts now highlight the agent profile, active listings count, smarter filters, and a richer empty state for better discovery.',
    'admin',
    now(),
    'agent-storefronts-upgrade-20260206'
  ),
  (
    'Contact agents directly',
    'Send a message to agents from their storefront with spam protection and faster follow-up.',
    'The new contact panel lets tenants and hosts reach agents directly from the storefront while keeping protection against spam.',
    'tenant',
    now(),
    'agent-storefronts-contact-20260206'
  ),
  (
    'Contact agents directly',
    'Send a message to agents from their storefront with spam protection and faster follow-up.',
    'The new contact panel lets tenants and hosts reach agents directly from the storefront while keeping protection against spam.',
    'host',
    now(),
    'agent-storefronts-contact-20260206'
  ),
  (
    'Contact agents directly',
    'Send a message to agents from their storefront with spam protection and faster follow-up.',
    'The new contact panel lets tenants and hosts reach agents directly from the storefront while keeping protection against spam.',
    'admin',
    now(),
    'agent-storefronts-contact-20260206'
  )
on conflict (source_ref, audience) do update
set title = excluded.title,
    summary = excluded.summary,
    body = excluded.body,
    published_at = excluded.published_at,
    updated_at = now();
