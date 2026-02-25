---
title: "Admin support inbox now supports canned replies with email send"
audiences:
  - ADMIN
areas:
  - Support
  - Operations
cta_href: "/admin/support"
published_at: "2026-02-25"
---

## What changed

- Added five canned reply templates in admin support tools:
  - We've received your request
  - Need more details
  - Resolved / next steps
  - Refund / billing guidance
  - Safety escalation guidance
- Added an admin-only reply API at `/api/admin/support/requests/[id]/reply` to send email replies to requesters.
- Added reply controls in the support drawer (`template`, `subject`, `message`, `Send reply`) so admins can respond from one place.
- Each successful send now logs metadata on the request:
  - `lastReplyAt`
  - `lastReplySubject`
  - `lastReplyTemplateId`
  - `lastReplyBy`
  - appended `replyHistory` entry with `reply_sent` event.

## Why it matters

- Support admins can respond in under 30 seconds without copy-pasting common guidance.
- Every outbound reply now has an audit trail in request metadata for follow-up and accountability.
