import { type NextRequest } from "next/server";
import { postPropertyStatusResponse } from "@/app/api/properties/[id]/status/route";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  return postPropertyStatusResponse(request, id);
}
