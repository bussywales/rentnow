import { type NextRequest } from "next/server";
import { POST as postPropertyFeature } from "@/app/api/properties/[id]/feature/route";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  return postPropertyFeature(request, context);
}
