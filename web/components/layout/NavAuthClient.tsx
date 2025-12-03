"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

type Props = {
  initialAuthed: boolean;
};

export function NavAuthClient({ initialAuthed }: Props) {
  const [isAuthed, setIsAuthed] = useState(initialAuthed);

  useEffect(() => {
    const supabase = createBrowserSupabaseClient();
    supabase.auth.getSession().then(({ data }) => {
      setIsAuthed(!!data.session);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthed(!!session);
    });
    return () => {
      subscription.unsubscribe();
    };
  }, []);

  if (isAuthed) {
    return (
      <>
        <Link href="/dashboard" className="hidden text-sm text-slate-700 md:block">
          My dashboard
        </Link>
        <form action="/auth/logout" method="post">
          <Button size="sm" type="submit" variant="secondary">
            Log out
          </Button>
        </form>
      </>
    );
  }

  return (
    <>
      <Link href="/auth/login" className="hidden text-sm text-slate-700 md:block">
        Log in
      </Link>
      <Link href="/auth/register">
        <Button size="sm">Get started</Button>
      </Link>
    </>
  );
}
