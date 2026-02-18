declare const supabase: {
  auth: {
    getSession?: unknown;
    [key: string]: unknown;
  };
};

// should FAIL
const gs = supabase.auth.getSession;
export async function GET() {
  return Response.json({ ok: !!gs });
}
