import test from "node:test";
import assert from "node:assert/strict";
import {
  buildOfflineSavedSearchLinks,
  normalizeOfflineFromPath,
  resolveOfflineRouteKind,
  resolveOfflineSectionVisibility,
} from "../../lib/offline/offline-route";

void test("normalizeOfflineFromPath keeps pathname + query and strips hash", () => {
  assert.equal(
    normalizeOfflineFromPath("/shortlets?city=Lagos#section"),
    "/shortlets?city=Lagos"
  );
  assert.equal(
    normalizeOfflineFromPath("https://www.propatyhub.com/properties?intent=rent"),
    "/properties?intent=rent"
  );
  assert.equal(normalizeOfflineFromPath(""), "/");
});

void test("resolveOfflineRouteKind classifies home/search/collections routes", () => {
  assert.equal(resolveOfflineRouteKind("/"), "home");
  assert.equal(resolveOfflineRouteKind("/shortlets?city=Abuja"), "search");
  assert.equal(resolveOfflineRouteKind("/properties?intent=buy"), "search");
  assert.equal(resolveOfflineRouteKind("/collections/weekend-getaways"), "collections");
  assert.equal(resolveOfflineRouteKind("/support"), "generic");
});

void test("buildOfflineSavedSearchLinks prioritizes route-aware resumes and dedupes", () => {
  const links = buildOfflineSavedSearchLinks({
    fromPath: "/shortlets?city=Lagos",
    recentSearchTerms: ["Lagos", "Abuja"],
    lastSearchHref: "/properties?intent=rent&city=Lagos",
    lastShortletBrowseHref: "/shortlets?city=Lekki",
    lastPropertyBrowseHref: "/properties?intent=buy&city=Abuja",
    limit: 5,
  });

  assert.ok(links.length > 0);
  assert.equal(links[0]?.href, "/shortlets?city=Lagos");
  assert.ok(links.some((item) => item.href === "/shortlets?city=Lekki"));
  assert.ok(links.some((item) => item.href === "/properties?intent=buy&city=Abuja"));
});

void test("resolveOfflineSectionVisibility applies route-aware section rules", () => {
  const home = resolveOfflineSectionVisibility({
    routeKind: "home",
    savedCount: 1,
    viewedCount: 0,
    recommendedCount: 2,
    savedSearchCount: 2,
  });
  assert.equal(home.showSaved, true);
  assert.equal(home.showRecommended, true);
  assert.equal(home.showSavedSearches, false);
  assert.equal(home.showEmptyState, false);

  const search = resolveOfflineSectionVisibility({
    routeKind: "search",
    savedCount: 0,
    viewedCount: 1,
    recommendedCount: 2,
    savedSearchCount: 1,
  });
  assert.equal(search.showSaved, false);
  assert.equal(search.showViewed, true);
  assert.equal(search.showSavedSearches, true);
  assert.equal(search.showRecommended, false);

  const collectionsEmpty = resolveOfflineSectionVisibility({
    routeKind: "collections",
    savedCount: 0,
    viewedCount: 0,
    recommendedCount: 0,
    savedSearchCount: 0,
  });
  assert.equal(collectionsEmpty.showCollectionsNote, true);
  assert.equal(collectionsEmpty.showEmptyState, true);
});
