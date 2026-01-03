import { NextResponse } from "next/server";

export async function GET() {
  const commit =
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ||
    null;
  const version = process.env.npm_package_version || null;

  return NextResponse.json({
    ok: true,
    timestamp: new Date().toISOString(),
    commit,
    version,
  });
}
