"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import {
  createBrowserSupabaseClient,
  getBrowserCookieOptions,
} from "@/lib/supabase/client";
import { useCallback } from "react";
import type { Session } from "@supabase/supabase-js";
import { normalizeRole } from "@/lib/roles";
import { writeSupabaseAuthCookie } from "@/lib/auth/client-cookie";

type Props = {
  initialAuthed: boolean;
  initialRole?: string | null;
};

export function NavAuthClient({ initialAuthed, initialRole = null }: Props) {
  const [isAuthed, setIsAuthed] = useState(initialAuthed);
  const [role, setRole] = useState<string | null>(normalizeRole(initialRole));
  const cookieOptions = getBrowserCookieOptions();

  const syncAuthCookie = useCallback(
    (session: { access_token: string; refresh_token: string } | null) => {
      if (!session?.access_token || !session?.refresh_token) return;
      writeSupabaseAuthCookie(
        {
          access_token: session.access_token,
          refresh_token: session.refresh_token,
        },
        cookieOptions
      );
    },
    [cookieOptions]
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
            const normalizedRole = normalizeRole(profile?.role);
            if (normalizedRole) setRole(normalizedRole);
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
            const normalizedRole = normalizeRole(profile?.role);
            if (normalizedRole) setRole(normalizedRole);
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
      writeSupabaseAuthCookie(null, cookieOptions);
      await fetch("/auth/logout", { method: "POST" });
    } catch (err) {
      console.warn("Logout failed, forcing reload", err);
    } finally {
      window.location.replace("/");
    }
  };

  const canShowDashboard =
    isAuthed && !!role && role !== "admin";
  const dashboardHref = role === "tenant" ? "/tenant" : "/dashboard";

  if (isAuthed) {
    return (
      <>
        {canShowDashboard && (
          <Link href={dashboardHref} className="hidden text-sm text-slate-700 md:block">
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
