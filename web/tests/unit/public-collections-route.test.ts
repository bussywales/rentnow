import test from "node:test";
import assert from "node:assert/strict";
import { GET } from "@/app/api/public/collections/[shareId]/route";

void test("public collections route returns 404 for invalid share id", async () => {
  const response = await GET(new Request("http://localhost/api/public/collections/not-a-uuid"), {
    params: Promise.resolve({ shareId: "not-a-uuid" }),
  });

  assert.equal(response.status, 404);
});
