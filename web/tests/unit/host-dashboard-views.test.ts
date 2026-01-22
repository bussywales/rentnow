import test from "node:test";
import assert from "node:assert/strict";
import { HOST_DASHBOARD_COPY, HOST_DASHBOARD_VIEWS } from "@/lib/host/host-dashboard-microcopy";
import { parseHostDashboardView, resolveInitialHostDashboardView } from "@/components/host/useHostDashboardView";

const expectedViews = {
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
};

void test("parses host dashboard views from URL", () => {
  assert.equal(parseHostDashboardView("ready"), "ready");
  assert.equal(parseHostDashboardView("needs_attention"), "needs_attention");
  assert.equal(parseHostDashboardView("unknown"), null);
  assert.equal(parseHostDashboardView(null), null);
});

void test("resolves initial view with URL preference then storage then default", () => {
  assert.equal(resolveInitialHostDashboardView("drafts", "needs_attention"), "drafts");
  assert.equal(resolveInitialHostDashboardView("unknown", "needs_attention"), "needs_attention");
  assert.equal(resolveInitialHostDashboardView(undefined, undefined), "all");
});

void test("host dashboard microcopy matches locked strings", () => {
  assert.deepStrictEqual(HOST_DASHBOARD_VIEWS, expectedViews);
  assert.deepStrictEqual(HOST_DASHBOARD_COPY, {
    title: "Saved views",
    helper: "Quick ways to focus on what needs attention.",
    resetLabel: "Reset view",
    resetHelper: "Clears filters and returns to the default view.",
    lastUpdatedLabel: "Last updated",
    bulkBar: {
      selected: "{count} selected",
      resume: "Resume setup",
      openFive: "Open up to 5",
      exportCsv: "Export CSV",
      clear: "Clear",
      helper: "Opens the first 5 to avoid tab overload.",
    },
    bulkModal: {
      title: "Resume setup",
      subtitle: "Open each listing where it needs attention.",
      empty: "No listings selected.",
      topIssue: "Top issue: {label}",
      open: "Open",
    },
  });
});
