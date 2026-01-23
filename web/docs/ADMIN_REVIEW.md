# Admin Review Desk

- Route: `/admin/review` (admin-only).
- Statuses:
  - `pending` listings appear in the desk.
  - Approve → `live` + `is_approved=true` + `is_active=true`.
  - Request changes → `changes_requested` + `is_approved=false` + `is_active=false` + `rejection_reason` stores the admin message.
- Actions:
  - Approve listing (one at a time) from the drawer.
  - Request changes requires a message to host; disables while sending.
- Notes:
  - No tenant surfaces are affected.
  - Review events currently reuse `rejection_reason`; append-only logs can be added later if needed.
  - Drawer updates the list locally and removes processed items from the pending view.
