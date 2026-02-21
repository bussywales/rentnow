import test from "node:test";
import assert from "node:assert/strict";
import {
  paginateShortletRows,
  resolveShortletPagination,
} from "@/lib/shortlet/search-pagination";

void test("same first page remains identical between page mode and cursor mode", () => {
  const rows = Array.from({ length: 20 }, (_, index) => ({ id: `listing-${index + 1}` }));

  const pageMode = resolveShortletPagination({
    page: 1,
    pageSize: 6,
    limitParam: null,
    cursorParam: null,
  });
  const cursorMode = resolveShortletPagination({
    page: 1,
    pageSize: 6,
    limitParam: "6",
    cursorParam: "0",
  });

  const paged = paginateShortletRows(rows, pageMode);
  const cursor = paginateShortletRows(rows, cursorMode);

  assert.deepEqual(
    paged.items.map((item) => item.id),
    cursor.items.map((item) => item.id)
  );
});

void test("nextCursor advances without overlap", () => {
  const rows = Array.from({ length: 12 }, (_, index) => ({ id: `listing-${index + 1}` }));
  const firstPage = paginateShortletRows(
    rows,
    resolveShortletPagination({
      page: 1,
      pageSize: 5,
      limitParam: "5",
      cursorParam: "0",
    })
  );

  assert.equal(firstPage.nextCursor, "5");

  const secondPage = paginateShortletRows(
    rows,
    resolveShortletPagination({
      page: 1,
      pageSize: 5,
      limitParam: "5",
      cursorParam: firstPage.nextCursor,
    })
  );

  assert.deepEqual(
    firstPage.items.map((item) => item.id),
    ["listing-1", "listing-2", "listing-3", "listing-4", "listing-5"]
  );
  assert.deepEqual(
    secondPage.items.map((item) => item.id),
    ["listing-6", "listing-7", "listing-8", "listing-9", "listing-10"]
  );
});

void test("pagination stays deterministic with no duplicates across cursor pages", () => {
  const rows = Array.from({ length: 17 }, (_, index) => ({ id: `listing-${index + 1}` }));
  const collected = new Set<string>();
  let cursor: string | null = "0";

  while (cursor !== null) {
    const page = paginateShortletRows(
      rows,
      resolveShortletPagination({
        page: 1,
        pageSize: 4,
        limitParam: "4",
        cursorParam: cursor,
      })
    );
    for (const item of page.items) {
      assert.equal(collected.has(item.id), false);
      collected.add(item.id);
    }
    cursor = page.nextCursor;
  }

  assert.equal(collected.size, rows.length);
});
