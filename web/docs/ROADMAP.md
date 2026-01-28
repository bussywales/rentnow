# Roadmap (Admin)

- vR16.9b.24: Admin review contracts + CI guards + runbook/postmortem.
- vR16.9b.26: Admin review uses `public.admin_review_view` as single source (includes computed media fields).
- vR16.9b.30: `/admin` embeds the Review Drawer + queue shell; single shared contracts/actions/tests across admin surfaces.
- vR16.9b.31: `/admin` isolated shell to prevent crashes; resilient error UI.
- vR16.9b.32: Restore `/dashboard` for all roles; Admin console tabs (Overview / Review queue / Listings) with minimal filters (price, type, beds, baths).
- Next 1–2 releases: Saved searches in admin, sorting (relevance/newest/price/readiness), pagination + DB indexes, host/admin audit log filters.
- Later (Airbnb+): Map-based search/radius, availability filters, quality-issues facets, consider materialized view or triggers if latency warrants; optional richer media for drawer only.
