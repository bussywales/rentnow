declare const supabase: {
  auth: {
    getSession?: unknown;
    [key: string]: unknown;
  };
};

// should FAIL
const { getSession } = supabase.auth;
export async function GET() {
  return Response.json({ ok: !!getSession });
}
