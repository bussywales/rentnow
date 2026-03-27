alter table public.help_tutorials
  add column if not exists seo_title text,
  add column if not exists meta_description text;

insert into public.help_tutorials (
  title,
  slug,
  summary,
  seo_title,
  meta_description,
  audience,
  visibility,
  status,
  video_url,
  body,
  published_at,
  created_at,
  updated_at
)
values (
  'Admin Listings Registry (Updated): Filters, Saved Views & Bulk Delete on PropatyHub',
  'admin-listings-registry-video-tutorial',
  'Video-backed admin tutorial for searching, sorting, filtering, saved views, and guarded bulk cleanup in the listings registry.',
  null,
  null,
  'admin',
  'internal',
  'published',
  'https://youtu.be/_jWHH5MQMAk',
  $tutorial$
## What this tutorial covers

- who the updated listings registry is for
- how to search by title, listing ID, owner, or location
- when to use sorts, saved views, and quality filters
- how owner identity now appears in review and listing rows
- how bulk deactivate and guarded bulk permanent delete work

## Intended audience

- Admins and internal operators using `/admin/listings`

<Callout type="info">
This is an internal admin tutorial. The route stays behind the existing `/help/admin/**` access guard.
</Callout>

## When to use the listings registry

Use `/admin/listings` when you need an operations view of all listings, not just the review queue.

Typical cases:

- find one listing fast by title, listing ID, owner, or location
- isolate weak inventory using quality and missing-item filters
- inspect featured or demo lifecycle state
- clean up tutorial, duplicate, or safe-only junk listings in bulk

If the goal is approval or rejection, use `/admin/review` instead.

## Search, filters, and saved views

The main search bar is the fastest starting point.

- search title and location text with partial matches
- match a listing ID exactly when you already have the record
- find listings by owner lookup when the profile or owner context is known

Once the result set is narrow enough, layer filters:

- status
- active or inactive
- quality state
- missing-item quick filters
- demo state
- featured lifecycle
- numeric and property-type filters

Saved views are useful when the same operator slice comes up repeatedly, for example:

- `Needs work + missing cover`
- `Live + expiring featured`
- `Demo listings pending cleanup`

## Sorting and URL-backed state

The registry supports server-backed sort controls for:

- created newest and oldest
- updated newest and oldest
- expiry soonest
- quality highest and lowest
- title A-Z
- live or approved newest

Search, sort, and filter state is URL-backed where relevant, so the current view can be refreshed or shared without rebuilding it manually.

## Owner identity visibility

The row identity model is now reviewer-first rather than raw-ID-first.

- primary: profile full name
- fallback: email when the admin-safe auth lookup is available
- fallback: owner UUID
- listing ID remains secondary copyable metadata for support and debugging

Use this identity order when triaging a listing before opening the inspector.

## Bulk cleanup and deletion safety

Bulk cleanup is selected-rows only in v1.

### Bulk deactivate

Use `Bulk deactivate` when the safest action is to remove listings from the marketplace while keeping operational history.

This is the right default for:

- stale tutorial clutter
- duplicate live rows
- items that should stop appearing publicly without hard deletion

### Guarded bulk permanent delete

Use `Bulk permanent delete` only for safe-only rows that are already removed and do not carry protected history.

The modal shows a preflight summary before anything destructive happens:

- selected count
- eligible count
- blocked count
- blocked reasons
- which rows should be deactivated first instead

Permanent delete also requires:

- an admin reason
- typed confirmation in the form `DELETE N LISTINGS`

That confirmation is bound to the current eligible count. If eligibility changes during the execute-time safety recheck, the modal resets and requires confirmation again.

## Safety rules and common mistakes

Do not use permanent delete as the default cleanup action.

Rows are blocked from purge when protected history exists, including:

- shortlet bookings and payments
- message threads
- listing leads
- viewing requests
- commission agreements
- featured or listing payment history
- property request response history

Common mistakes to avoid:

- assuming a blocked row is broken rather than intentionally protected
- treating deactivate and permanent delete as interchangeable
- skipping the preflight summary
- using review workflows for registry cleanup work

## Related help pages

- [Admin core workflows](/help/admin/core-workflows)
- [Admin listings ops runbook](/help/admin/listings)
- [Admin & ops help landing](/help/admin)
- [Listings registry durable runbook](/admin/listings)
$tutorial$,
  '2026-03-27T00:00:00.000Z',
  now(),
  now()
)
on conflict (audience, slug) do update
set
  title = excluded.title,
  summary = excluded.summary,
  seo_title = excluded.seo_title,
  meta_description = excluded.meta_description,
  visibility = excluded.visibility,
  status = excluded.status,
  video_url = excluded.video_url,
  body = excluded.body,
  published_at = coalesce(public.help_tutorials.published_at, excluded.published_at),
  unpublished_at = null,
  updated_at = now();
