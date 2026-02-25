import { NextResponse, type NextRequest } from "next/server";
import { searchAgentsDirectory } from "@/lib/agents/agents-directory.server";

export const dynamic = "force-dynamic";

export type AgentsDirectorySearchRouteDeps = {
  searchAgentsDirectory: typeof searchAgentsDirectory;
};

const defaultDeps: AgentsDirectorySearchRouteDeps = {
  searchAgentsDirectory,
};

function parseLimit(value: string | null) {
  const parsed = Number.parseInt(value || "", 10);
  if (!Number.isFinite(parsed)) return 24;
  return Math.min(48, Math.max(1, parsed));
}

function parseOffset(value: string | null) {
  const parsed = Number.parseInt(value || "", 10);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, parsed);
}

export async function getAgentsSearchResponse(
  request: NextRequest,
  deps: AgentsDirectorySearchRouteDeps = defaultDeps
) {
  const q = String(request.nextUrl.searchParams.get("q") || "").trim();
  const location = String(request.nextUrl.searchParams.get("location") || "").trim();
  const verifiedOnly = request.nextUrl.searchParams.get("verified") !== "0";
  const limit = parseLimit(request.nextUrl.searchParams.get("limit"));
  const offset = parseOffset(request.nextUrl.searchParams.get("offset"));

  try {
    const result = await deps.searchAgentsDirectory({
      q,
      location,
      verifiedOnly,
      limit,
      offset,
    });

    return NextResponse.json({
      ok: true,
      q,
      location,
      verifiedOnly,
      ...result,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to load agents directory.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return getAgentsSearchResponse(request, defaultDeps);
}
