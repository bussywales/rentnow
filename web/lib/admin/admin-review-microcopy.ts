export const ADMIN_REVIEW_COPY = {
  headerTitle: "Review desk",
  headerSubtitle: "Approve listings, fix issues, and keep quality high.",
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
  },
  drawer: {
    overview: "Overview",
    media: "Media",
    location: "Location",
    notes: "Notes",
    close: "Close",
    placeholder: "Details will appear here when you select a listing.",
  },
};

export type AdminReviewCopyKeys =
  | keyof typeof ADMIN_REVIEW_COPY
  | keyof (typeof ADMIN_REVIEW_COPY)["list"]
  | keyof (typeof ADMIN_REVIEW_COPY)["drawer"];
