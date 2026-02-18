declare const supabase: {
  auth: {
    getSession?: unknown;
    [key: string]: unknown;
  };
};

// should FAIL
export async function GET() {
  return Response.json({ s: !!supabase.auth.getSession });
}
