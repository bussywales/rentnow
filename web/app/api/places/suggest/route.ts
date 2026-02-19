import { NextResponse, type NextRequest } from "next/server";
import { getPlaceSuggestions } from "@/lib/places/suggest";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const q = String(request.nextUrl.searchParams.get("q") || "").trim();
  if (!q) {
    return NextResponse.json({ suggestions: [] });
  }

  const market = request.nextUrl.searchParams.get("market");
  const limit = Number(request.nextUrl.searchParams.get("limit") || "8");
  const suggestions = getPlaceSuggestions({
    q,
    market,
    limit: Number.isFinite(limit) ? limit : 8,
  });

  return NextResponse.json(
    {
      suggestions,
    },
    {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=900",
      },
    }
  );
}
