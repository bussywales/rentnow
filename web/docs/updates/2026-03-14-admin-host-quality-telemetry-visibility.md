---
title: Admin host quality telemetry visibility
date: 2026-03-14
audiences:
  - ADMIN
areas:
  - admin
  - listings
  - quality
  - telemetry
summary: Admin host analytics now includes a compact report for submit-step listing quality guidance usage and score improvement before submit.
rollback: git revert <sha>
---

## What changed

- Added a compact host quality guidance telemetry section to the admin host analytics page.
- The report shows guidance views, fix-click volume, click-through rate, submit attempts with quality telemetry, improvement rate, and average score delta.
- Added a simple breakdown of which target steps hosts click most: Basics, Details, and Photos.

## Why this helps

- Admins can now see whether hosts are using the submit-step quality guidance.
- The step breakdown makes it clear where hosts most often need to jump back and fix their listings.
- Improvement-rate visibility helps evaluate whether the host quality UX is actually lifting listing quality before submit.

## Rollback

- Revert the commit for this batch.
