import { NextResponse } from "next/server";

export async function GET() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnon = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const storageBucket = process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET;
  const openai = process.env.OPENAI_API_KEY || process.env.OPENAI_APT_KEY;

  return NextResponse.json({
    supabaseUrl: !!supabaseUrl,
    supabaseAnon: !!supabaseAnon,
    storageBucket: !!storageBucket,
    openai: !!openai,
    runtime: process.env.VERCEL ? "vercel" : "local",
  });
}
