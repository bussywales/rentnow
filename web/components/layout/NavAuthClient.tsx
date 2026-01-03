"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { useCallback } from "react";
import type { Session } from "@supabase/supabase-js";

type Props = {
  initialAuthed: boolean;
  initialRole?: string | null;
};

export function NavAuthClient({ initialAuthed, initialRole = null }: Props) {
  const [isAuthed, setIsAuthed] = useState(initialAuthed);
  const [role, setRole] = useState<string | null>(initialRole);
  const projectRef =
    process.env.NEXT_PUBLIC_SUPABASE_URL?.match(/https:\/\/(.*?)\.supabase\.co/)?.[1] ||
    "supabase";
  const authCookieName = `sb-${projectRef}-auth-token`;

  const syncAuthCookie = useCallback(
    (session: { access_token: string; refresh_token: string } | null) => {
      if (!session) {
        document.cookie = `${authCookieName}=; path=/; max-age=0; secure; samesite=lax`;
        return;
      }
      const payload = encodeURIComponent(JSON.stringify(session));
      // 7 days by default
      document.cookie = `${authCookieName}=${payload}; path=/; max-age=${60 * 60 * 24 * 7}; secure; samesite=lax`;
    },
    [authCookieName]
  );

  useEffect(() => {
    const sync = syncAuthCookie;
    const supabase = createBrowserSupabaseClient();
    supabase.auth.getSession().then(({ data }: { data: { session: Session | null } }) => {
      const session = data.session;
      setIsAuthed(!!session);
      if (session?.user?.id) {
        supabase
          .from("profiles")
          .select("role")
          .eq("id", session.user.id)
          .maybeSingle()
          .then(({ data: profile }: { data: { role?: string } | null }) => {
            if (profile?.role) setRole(profile.role);
          })
          .catch(() => undefined);
      }
      if (session?.access_token && session?.refresh_token) {
        sync({
          access_token: session.access_token,
          refresh_token: session.refresh_token,
        });
      }
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event: unknown, session: Session | null) => {
      setIsAuthed(!!session);
      if (session?.user?.id) {
        supabase
          .from("profiles")
          .select("role")
          .eq("id", session.user.id)
          .maybeSingle()
          .then(({ data: profile }: { data: { role?: string } | null }) => {
            if (profile?.role) setRole(profile.role);
          })
          .catch(() => undefined);
      } else {
        setRole(null);
      }
      if (session?.access_token && session?.refresh_token) {
        syncAuthCookie({
          access_token: session.access_token,
          refresh_token: session.refresh_token,
        });
      } else {
        syncAuthCookie(null);
      }
    });
    return () => {
      subscription.unsubscribe();
    };
  }, [syncAuthCookie]);

  const handleLogout = async () => {
    try {
      const supabase = createBrowserSupabaseClient();
      await supabase.auth.signOut();
      syncAuthCookie(null);
      await fetch("/auth/logout", { method: "POST" });
    } catch (err) {
      console.warn("Logout failed, forcing reload", err);
    } finally {
      window.location.replace("/");
    }
  };

  const canShowDashboard = isAuthed && role !== "tenant";

  if (isAuthed) {
    return (
      <>
        {canShowDashboard && (
          <Link href="/dashboard" className="hidden text-sm text-slate-700 md:block">
            My dashboard
          </Link>
        )}
        <Button size="sm" type="button" variant="secondary" onClick={handleLogout}>
          Log out
        </Button>
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
