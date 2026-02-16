---
title: "Tenant shortlets: trips"
description: "Understand Request to book vs Reserve, track trip statuses, and know what to do next."
order: 36
updated_at: "2026-02-16"
---

## Where to manage trips

- Open `/trips` to see all your shortlet bookings.
- Open `/trips/[bookingId]` for booking details and status guidance.
- From a listing page (`/properties/[id]`), use **My trips** after booking.

## Booking modes on listing pages

- **Request to book**: host approval is required after payment succeeds.
- **Reserve**: instant confirmation after payment succeeds.

## Paying for a shortlet booking

1. On the listing page, choose dates and select **Continue to payment**.
2. On checkout, choose:
   - **Pay by Card (recommended)** (Stripe)
   - **Pay with Nigerian methods** (Paystack)
3. After payment, open `/trips/[bookingId]` to track the status.

## Trip status guide

- `pending_payment`: booking created, payment not completed yet.
- `pending`: waiting for host response.
- `confirmed`: stay is reserved.
- `completed`: stay finished.
- `declined` / `cancelled` / `expired`: this trip is closed.

## Tips for smoother bookings

1. Double-check check-in/check-out dates before submitting.
2. Use the trip detail page to confirm totals and booking status.
3. If a request is declined or expired, choose new dates and submit a new request.

<Callout type="info">
Manual payouts are host/admin operations in this pilot. Tenant trip status and totals remain visible in Trips.
</Callout>
