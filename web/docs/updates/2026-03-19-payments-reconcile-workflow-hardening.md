---
title: Payments reconcile workflow hardening
date: 2026-03-19
audiences:
  - ADMIN
areas:
  - ops
  - workflows
  - payments
summary: Hardened the Payments Reconcile GitHub Actions workflow with clearer secret validation, endpoint-level diagnostics, failure artifacts, and updated action runtimes to reduce Node 20 deprecation warnings.
---

## What was found

The failing `Payments Reconcile` run could not be diagnosed from the screenshot alone because the workflow bundled both reconcile endpoint calls into one shell step and only surfaced a generic exit code at the job level.

## What was hardened

- Added an explicit secret-validation step for `APP_URL` and `CRON_SECRET`.
- Split the workflow into separate named steps for the payments batch reconcile endpoint and the shortlet reconcile endpoint.
- Added safe per-endpoint diagnostics with response headers, body, curl verbose output, and step summaries.
- Added failure artifact upload for the captured reconcile diagnostics.

## Node 20 deprecation

- Updated the workflow to use newer `actions/checkout` and `actions/setup-node` majors so the deprecated Node 20 action runtime warning is addressed for this workflow.
- Kept the project Node version at `20.9.0`; this change updates the action runtime, not the application runtime.

## Rollback

- `git revert <sha>`
