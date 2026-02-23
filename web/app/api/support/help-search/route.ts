import { NextResponse, type NextRequest } from "next/server";
import { searchSupportHelpDocs } from "@/lib/support/help-search";

export const dynamic = "force-dynamic";

export type SupportHelpSearchDeps = {
  searchSupportHelpDocs: typeof searchSupportHelpDocs;
};

const defaultDeps: SupportHelpSearchDeps = {
  searchSupportHelpDocs,
};

function normalizeLimit(value: string | null) {
  const parsed = Number.parseInt(value || "", 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return 6;
  return Math.min(parsed, 10);
}

export async function getSupportHelpSearchResponse(
  request: NextRequest,
  deps: SupportHelpSearchDeps = defaultDeps
) {
  const { searchParams } = new URL(request.url);
  const query = String(searchParams.get("q") || "").trim();
  const limit = normalizeLimit(searchParams.get("limit"));

  if (query.length < 2) {
    return NextResponse.json({ ok: true, query, results: [] });
  }

  try {
    const results = await deps.searchSupportHelpDocs(query, limit);
    return NextResponse.json({
      ok: true,
      query,
      results,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to search help articles.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return getSupportHelpSearchResponse(request, defaultDeps);
}

