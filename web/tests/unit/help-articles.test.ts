import test from "node:test";
import assert from "node:assert/strict";
import {
  canViewerAccessArticle,
  filterAgentHelpArticles,
  filterHelpArticlesForViewer,
  type HelpArticle,
} from "@/lib/help/articles";

const SAMPLE_ARTICLES: HelpArticle[] = [
  {
    slug: "public-guide",
    title: "Public",
    description: "",
    role: "public",
    category: "General",
    order: 1,
    tags: [],
    updatedAt: "2026-02-10",
    body: "",
  },
  {
    slug: "host-guide",
    title: "Host",
    description: "",
    role: "host",
    category: "General",
    order: 2,
    tags: [],
    updatedAt: "2026-02-10",
    body: "",
  },
  {
    slug: "agent-guide",
    title: "Agent",
    description: "",
    role: "agent",
    category: "General",
    order: 3,
    tags: [],
    updatedAt: "2026-02-10",
    body: "",
  },
  {
    slug: "admin-guide",
    title: "Admin",
    description: "",
    role: "admin",
    category: "General",
    order: 4,
    tags: [],
    updatedAt: "2026-02-10",
    body: "",
  },
];

void test("article role visibility respects viewer role", () => {
  assert.equal(canViewerAccessArticle("public", null), true);
  assert.equal(canViewerAccessArticle("host", "landlord"), true);
  assert.equal(canViewerAccessArticle("host", "agent"), true);
  assert.equal(canViewerAccessArticle("agent", "agent"), true);
  assert.equal(canViewerAccessArticle("agent", "landlord"), false);
  assert.equal(canViewerAccessArticle("admin", "admin"), true);
  assert.equal(canViewerAccessArticle("admin", "agent"), false);
});

void test("help article filtering is role-aware", () => {
  const publicVisible = filterHelpArticlesForViewer(SAMPLE_ARTICLES, null).map((item) => item.slug);
  assert.deepEqual(publicVisible, ["public-guide"]);

  const hostVisible = filterHelpArticlesForViewer(SAMPLE_ARTICLES, "landlord").map((item) => item.slug);
  assert.deepEqual(hostVisible, ["public-guide", "host-guide"]);

  const agentVisible = filterHelpArticlesForViewer(SAMPLE_ARTICLES, "agent").map((item) => item.slug);
  assert.deepEqual(agentVisible, ["public-guide", "host-guide", "agent-guide"]);

  const curatedAgentVisible = filterAgentHelpArticles(SAMPLE_ARTICLES, "agent").map((item) => item.slug);
  assert.equal(curatedAgentVisible.includes("admin-guide"), false);
});
