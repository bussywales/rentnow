import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST() {
  return NextResponse.json(
    {
      error: "This endpoint is deprecated. Use /api/properties/:id/video/init and /commit.",
      code: "video_upload_deprecated",
    },
    { status: 410 }
  );
}
