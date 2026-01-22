export const HOST_DASHBOARD_VIEWS = {
  all: {
    label: "All listings",
    description: "All your listings, sorted by what needs attention first.",
  },
  needs_attention: {
    label: "Needs attention",
    description: "Listings missing required or recommended details.",
    empty: "No listings need attention right now.",
  },
  drafts: {
    label: "Drafts",
    description: "Listings you haven’t published yet.",
    empty: "You don’t have any drafts.",
  },
  ready: {
    label: "Ready to publish",
    description: "Listings that meet all current publishing requirements.",
    empty: "No listings are ready to publish yet.",
  },
} as const;

export const HOST_DASHBOARD_COPY = {
  title: "Saved views",
  helper: "Quick ways to focus on what needs attention.",
  resetLabel: "Reset view",
  resetHelper: "Clears filters and returns to the default view.",
};
