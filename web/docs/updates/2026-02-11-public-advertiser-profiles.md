# Public Advertiser Profiles (W4.1 + W4.1.1)

PropatyHub now includes public advertiser profile pages for agents and landlords at `/agents/[slug]`, with `/u/[id]` kept as a backward-compatible redirect.

## What shipped

- New public advertiser page with:
  - name, role, location, joined date
  - trust badge row with link to `What does Verified mean?`
  - active listings stats and popular-listings indicator
  - live listings grid using existing listing cards and trust/status badges
- Marketing-friendly canonical URLs:
  - `/agents/[slug]` resolves advertiser pages for agent/landlord profiles
  - `/u/[id]` now redirects to `/agents/[slug]` when a public slug exists
- Listing detail now links the hosted-by section to advertiser profiles when available.
- Listing cards now prefer linking `By {Advertiser}` to `/agents/[slug]` and fall back to `/u/[id]`.

## Safety and privacy

- Tenant profiles are not public advertiser profiles and are not exposed.
- Private contact/verification fields are not rendered on public profile pages.
- Public profile listings are restricted to active, approved, live listings.
- Demo listings respect existing demo visibility rules for non-admin viewers.
