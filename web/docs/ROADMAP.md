# Roadmap (admin review hardening)

- vR16.9b.24: Admin review contracts + CI guards + runbook/postmortem.
- vR16.9b.26: Admin review uses `public.admin_review_view` as single source (includes computed media fields).
- vR16.9b.30: `/admin` embeds the Review Drawer + queue shell; single shared contracts/actions/tests across admin surfaces.
- Next: consider materialized view or triggers if latency warrants; optional richer media for drawer only.
