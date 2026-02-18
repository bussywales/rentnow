declare const supabase: {
  auth: {
    getSession?: unknown;
    [key: string]: unknown;
  };
};

// should FAIL
export async function GET() {
  const fn = supabase.auth["getSession"];
  return Response.json({ fn: !!fn });
}
