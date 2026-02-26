import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { performShare } from "@/lib/share/client-share";

void test("performShare prefers native share when available", async () => {
  const calls: string[] = [];
  const result = await performShare(
    {
      title: "Weekend getaways · PropatyHub",
      text: "Explore this collection on PropatyHub.",
      url: "https://www.propatyhub.com/collections/weekend-getaways",
    },
    {
      share: async () => {
        calls.push("share");
      },
      canShare: () => true,
      writeClipboardText: async () => {
        calls.push("clipboard");
      },
    }
  );

  assert.equal(result, "shared");
  assert.deepEqual(calls, ["share"]);
});

void test("performShare falls back to clipboard when native share is unavailable", async () => {
  let copied = "";
  const result = await performShare(
    {
      title: "Collections",
      url: "https://www.propatyhub.com/collections/weekend-getaways",
    },
    {
      share: null,
      writeClipboardText: async (value) => {
        copied = value;
      },
    }
  );

  assert.equal(result, "copied");
  assert.equal(copied, "https://www.propatyhub.com/collections/weekend-getaways");
});

void test("performShare uses execCopy when clipboard write fails", async () => {
  const result = await performShare(
    {
      title: "Collections",
      url: "https://www.propatyhub.com/collections/weekend-getaways",
    },
    {
      share: null,
      writeClipboardText: async () => {
        throw new Error("clipboard blocked");
      },
      execCopy: () => true,
    }
  );

  assert.equal(result, "copied");
});

void test("collections hero mounts share button with stable test ids", () => {
  const heroSourcePath = path.join(process.cwd(), "components", "collections", "CollectionHero.tsx");
  const heroSource = fs.readFileSync(heroSourcePath, "utf8");
  const shareSourcePath = path.join(process.cwd(), "components", "share", "ShareButton.tsx");
  const shareSource = fs.readFileSync(shareSourcePath, "utf8");

  assert.match(heroSource, /import\s+\{\s*ShareButton\s*\}\s+from\s+"@\/components\/share\/ShareButton"/);
  assert.match(heroSource, /testId="collections-share-button"/);
  assert.match(shareSource, /data-testid="share-copy-success"/);
});
