export const ADMIN_REVIEW_COPY = {
  headerTitle: "Review desk",
  headerSubtitle: "Approve listings, fix issues, and keep quality high.",
  savedViews: "Saved views",
  views: {
    pending: "Pending",
    changes: "Changes requested",
    approved: "Approved (recent)",
    all: "All",
    reset: "Reset",
  },
  searchPlaceholder: "Search by listing title or host…",
  filters: {
    hasVideo: "Has video",
    needsLocation: "Needs location",
    needsPhotos: "Needs photos",
  },
  sort: {
    label: "Sort",
    oldest: "Oldest first",
    newest: "Newest first",
  },
  list: {
    emptyTitle: "No listings to review",
    emptyBody: "New submissions will appear here when hosts send them for approval.",
    columns: {
      title: "Title",
      host: "Host",
      updated: "Last updated",
      readiness: "Readiness",
      location: "Location quality",
      photos: "Photos",
      video: "Video",
    },
    reviewCta: "Review",
    openEditor: "Open editor",
    hiddenNotice: "This listing is hidden by your current filters.",
    showHidden: "Show it anyway",
  },
  drawer: {
    overview: "Overview",
    media: "Media",
    location: "Location",
    notes: "Notes",
    close: "Close",
    placeholder: "Details will appear here when you select a listing.",
    previous: "Previous",
    next: "Next",
  },
};

export type AdminReviewCopyKeys =
  | keyof typeof ADMIN_REVIEW_COPY
  | keyof (typeof ADMIN_REVIEW_COPY)["list"]
  | keyof (typeof ADMIN_REVIEW_COPY)["drawer"];
