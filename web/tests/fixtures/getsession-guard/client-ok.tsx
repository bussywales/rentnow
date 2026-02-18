"use client";

declare const supabase: {
  auth: {
    getSession?: unknown;
    [key: string]: unknown;
  };
};

// should PASS because client files are excluded
export default function ClientOk() {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const x = supabase.auth.getSession;
  return null;
}
