import { buildTabHref, normalizeTabParam } from "@/lib/admin/admin-tabs";

describe("admin tab helpers", () => {
  test("default tab is review when missing", () => {
    expect(normalizeTabParam(undefined)).toBe("review");
    expect(normalizeTabParam(null as unknown as undefined)).toBe("review");
  });

  test("parses valid tab values", () => {
    expect(normalizeTabParam("overview")).toBe("overview");
    expect(normalizeTabParam(["listings"])).toBe("listings");
  });

  test("buildTabHref preserves id and other params", () => {
    const href = buildTabHref(
      { id: "abc", view: "pending", foo: ["1", "2"] },
      "listings"
    );
    expect(href).toBe("/admin?id=abc&view=pending&foo=1&foo=2&tab=listings");
  });

  test("buildTabHref omits tab when selecting default tab review", () => {
    const href = buildTabHref({ id: "abc" }, "review");
    expect(href).toBe("/admin?id=abc");
  });
});
