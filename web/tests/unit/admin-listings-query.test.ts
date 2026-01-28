import { parseAdminListingsQuery } from "@/lib/admin/admin-listings";

describe("admin listings query parsing", () => {
  test("defaults are applied when params missing", () => {
    const parsed = parseAdminListingsQuery({});
    expect(parsed.q).toBeNull();
    expect(parsed.qMode).toBe("title");
    expect(parsed.status).toBeNull();
    expect(parsed.active).toBe("all");
    expect(parsed.page).toBe(1);
    expect(parsed.pageSize).toBeGreaterThanOrEqual(10);
    expect(parsed.sort).toBe("updated_at.desc");
  });

  test("parses provided query params", () => {
    const parsed = parseAdminListingsQuery({
      q: "Lagos",
      qMode: "title",
      status: "live",
      active: "active",
      page: "2",
      pageSize: "25",
      sort: "updated_at.asc",
    });
    expect(parsed.q).toBe("Lagos");
    expect(parsed.qMode).toBe("title");
    expect(parsed.status).toBe("live");
    expect(parsed.active).toBe("active");
    expect(parsed.page).toBe(2);
    expect(parsed.pageSize).toBe(25);
    expect(parsed.sort).toBe("updated_at.asc");
  });

  test("detects uuid and defaults to id mode when qMode missing", () => {
    const parsed = parseAdminListingsQuery({
      q: "dad2bb26-fe36-4096-b81a-f86d230f9b3d",
    });
    expect(parsed.q).toBe("dad2bb26-fe36-4096-b81a-f86d230f9b3d");
    expect(parsed.qMode).toBe("id");
  });

  test("invalid status and active fall back safely", () => {
    const parsed = parseAdminListingsQuery({
      status: "bogus",
      active: "nope",
      page: "-1",
    });
    expect(parsed.status).toBeNull();
    expect(parsed.active).toBe("all");
    expect(parsed.page).toBe(1);
  });
});
