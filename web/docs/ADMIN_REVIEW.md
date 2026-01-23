# Admin Review Desk

- Route: `/admin/review` (admin-only).
- Statuses:
  - `pending` listings appear in the desk.
  - Approve → `live` + `is_approved=true` + `is_active=true`.
  - Request changes → `changes_requested` + `is_approved=false` + `is_active=false` + `rejection_reason` stores the admin message.
- Actions:
  - Approve listing (one at a time) from the drawer.
  - Request changes uses a structured rubric of reasons (location, pin, photos, cover, video, copy, pricing). Admin can add/edit the message or regenerate from reasons. At least one reason or a non-empty message is required.
  - Payload stored as JSON in `rejection_reason`:
    ```json
    {
      "type": "admin_review_request_changes",
      "reasons": ["needs_location", "needs_cover"],
      "message": "Please clarify the area and set a cover.",
      "reviewed_at": "<ISO>",
      "reviewed_by": "<admin user id>"
    }
    ```
    Legacy plain-text values are still parsed as message-only.
- Notes:
  - No tenant surfaces are affected.
  - Review events currently reuse `rejection_reason`; append-only logs can be added later if needed.
  - Drawer updates the list locally and removes processed items from the pending view.
- Saved views & filters:
  - Views: `pending` (default), `changes requested`, `approved (recent)`, `all` – stored in URL and remembered per admin in localStorage.
  - Filters/search/sort: search by title/host/location, toggle has video, needs location/photos, sort oldest/newest; reset returns to defaults.
  - Drawer prev/next navigation follows the currently visible (filtered) list; a hidden-by-filters notice can clear filters and snap to the selected item.
- Host experience:
  - When status is `changes_requested`, hosts see a “Fix requested” panel in the editor showing the admin reasons/message and deep links to Photos/Location/Details. Dismissal is session-only and keyed to the payload; legacy plain-text rejection reasons still display as message-only.
  - Hosts can “Resubmit for approval” after fixing items; resubmit transitions `changes_requested` → `pending` and hides the fix panel locally.
- Lifecycle:
  - pending → admin approves (live) or requests changes (changes_requested)
  - changes_requested → host resubmits → pending (returns to admin review desk)
  - pending items appear in the admin Review desk Pending view; approved/rejected behavior unchanged.
