import { buildTabHref, normalizeTabParam } from "@/lib/admin/admin-tabs";

describe("admin tab helpers", () => {
  test("default tab is overview when missing", () => {
    expect(normalizeTabParam(undefined)).toBe("overview");
    expect(normalizeTabParam(null as unknown as undefined)).toBe("overview");
  });

  test("parses valid tab values", () => {
    expect(normalizeTabParam("overview")).toBe("overview");
    expect(normalizeTabParam(["listings"])).toBe("listings");
  });

  test("buildTabHref preserves id and view params", () => {
    const href = buildTabHref(
      { id: "abc", view: "pending" },
      "listings"
    );
    expect(href).toBe("/admin?id=abc&view=pending&tab=listings");
  });

  test("buildTabHref omits tab when selecting default tab overview", () => {
    const href = buildTabHref({ id: "abc" }, "overview");
    expect(href).toBe("/admin?id=abc");
  });
});
