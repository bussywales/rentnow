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
  'How to Find Short-Let Stays on PropatyHub',
  'find-shortlets-on-propatyhub',
  'Learn how to search for short-term stays on PropatyHub using the destination field, date picker, guest selector and powerful filters. Understand quick filter chips, the difference between "Reserve" and "Request" listings, and how to use the map to focus your search.',
  'Find Shortlet Apartments & Houses on PropatyHub | Search Guide',
  'A step-by-step guide showing travellers how to search for short-let apartments and houses on PropatyHub. Covers destination entry, date and guest selection, quick filters, the full filters panel, map search, and interpreting results.',
  'tenant',
  'public',
  'published',
  null,
  $tutorial$
## What this tutorial covers

This tutorial is for tenants and travellers who want nightly stays on PropatyHub. It focuses on the dedicated `/shortlets` search page and shows how to narrow results quickly without jumping into booking or payment steps.

## Where to start

You can open shortlets in two common ways:

- use the **Shortlets** link in the top navigation
- from `/tenant/home`, use **Browse shortlets**, which currently routes into the shortlet browse flow through `/properties?stay=shortlet`

If you already know you want a nightly stay, starting on `/shortlets` is the cleanest path.

## Enter destination, dates, and guests

At the top of the page, use the main search controls:

1. Enter an area, city, or landmark in **Where to?**.
2. Open **Dates** and choose your check-in and check-out range.
3. Set the number of guests in the guest selector.
4. Run **Search**.

The page updates the shortlet results and keeps the map aligned to the current search state.

## Use the quick filters first

Before opening the full filter drawer, you can use the quick chips under the search bar for common essentials:

- **Power backup**
- **Borehole water**
- **Security / gated**

These are useful when you want to tighten the result set fast before applying deeper filters.

## Read the result cards correctly

After searching, review the result cards and the live result count.

Each card helps you compare:

- location
- nightly price
- whether free cancellation is available
- the booking mode shown on the CTA

The main booking labels mean:

- **Reserve**: the stay can usually confirm immediately when dates are available
- **Request**: the stay needs host approval before it is confirmed

Use these labels to set expectations before opening a listing.

## Open the Filters panel for deeper control

Select **Filters** to open the full filter drawer. The live shortlets page currently supports these filter groups:

### Amenities and trust

- Power backup
- Borehole water
- Security / gated
- Wi-Fi
- Verified host

### Booking mode

- All booking modes
- Instant book
- Request to book

### Cancellation

- Free cancellation

### View options

- Search as I move the map
- Display total price
- Saved only

Use **Apply** to commit the current filter set. Use **Reset** to return the drawer to the default state. Use **Clear all** to remove active filters entirely.

## Use the map to focus a specific area

The map is part of the shortlets workflow, not just decoration.

You can:

- pan and zoom to a tighter area
- use **Search this area** when it appears after moving the map
- use **Hide map** if you want more room for listing cards
- watch the results count to confirm how much the map or filters changed the result set

This is especially useful when you know the district you want but not the exact landmark.

## Save stays you want to compare later

When a shortlet looks promising, use the heart icon on the card to save it. That makes it easier to come back to the strongest options once you have narrowed your shortlist.

If you are continuing through the shortlets help series, keep those saved stays ready for the favourites and comparisons workflow.

## Tips to avoid wasted clicks

- set dates before relying on price comparisons
- use quick chips first, then open full filters only when needed
- check **Reserve** versus **Request** before assuming a stay will confirm instantly
- use the map when the area matters more than the exact listing title

## Related help

- [Tenant shortlets](/help/tenant/shortlets)
- [Tenant shortlets: discovery and booking](/help/tenant/shortlets-discovery)
- [Tenant shortlets: trips](/help/tenant/shortlets-trips)
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
