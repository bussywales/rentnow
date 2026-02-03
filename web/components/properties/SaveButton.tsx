"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { cn } from "@/components/ui/cn";

type Props = {
  propertyId: string;
  initialSaved?: boolean;
  variant?: "button" | "icon";
  className?: string;
};

const SAVE_INTENT_KEY = "ph:save-intent";

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      aria-hidden
      className={cn("h-4 w-4", filled ? "fill-current" : "fill-none")}
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="1.6"
    >
      <path
        d="M20.5 12.2c-.9 2.8-4.7 6-8.5 8.8-3.8-2.8-7.6-6-8.5-8.8-1-3.1.6-6.2 3.8-6.9 1.9-.4 3.8.2 4.7 1.6.9-1.4 2.8-2 4.7-1.6 3.2.7 4.8 3.8 3.8 6.9z"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function SaveButton({
  propertyId,
  initialSaved = false,
  variant = "button",
  className,
}: Props) {
  const [saved, setSaved] = useState(initialSaved);
  const [loading, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const supabaseEnabled =
    !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
    !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const isDemoSave = propertyId.startsWith("mock-") || !supabaseEnabled;

  const currentPath = useMemo(() => {
    const query = searchParams?.toString();
    return query ? `${pathname}?${query}` : pathname;
  }, [pathname, searchParams]);

  const loginHref = `/auth/login?reason=auth&redirect=${encodeURIComponent(currentPath)}`;

  useEffect(() => {
    setSaved(initialSaved);
  }, [initialSaved]);

  useEffect(() => {
    if (isDemoSave || saved) return;
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(SAVE_INTENT_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { propertyId?: string };
      if (parsed?.propertyId !== propertyId) return;
      window.localStorage.removeItem(SAVE_INTENT_KEY);
      handleToggle(true);
    } catch {
      // ignore malformed storage
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDemoSave, propertyId, saved]);

  const handleToggle = (forced?: boolean) => {
    const nextSaved = typeof forced === "boolean" ? forced : !saved;
    if (saved && nextSaved) return;
    const previousSaved = saved;
    startTransition(async () => {
      setError(null);
      setNotice(null);

      if (isDemoSave) {
        setSaved(nextSaved);
        setNotice("Saved in demo mode. Connect Supabase and log in to sync.");
        return;
      }

      const trimmedId = propertyId.trim();
      if (!trimmedId) {
        setSaved(previousSaved);
        setError("Unable to save: missing property id. Please refresh and try again.");
        return;
      }

      try {
        setSaved(nextSaved);
        const method = nextSaved ? "POST" : "DELETE";
        const url =
          method === "DELETE"
            ? `/api/saved-properties?property_id=${propertyId}`
            : "/api/saved-properties";
        const res = await fetch(url, {
          method,
          headers: { "Content-Type": "application/json" },
          body: method === "POST" ? JSON.stringify({ property_id: trimmedId }) : undefined,
        });
        if (!res.ok) {
          if (res.status === 401) {
            if (typeof window !== "undefined") {
              window.localStorage.setItem(
                SAVE_INTENT_KEY,
                JSON.stringify({ propertyId: trimmedId, at: Date.now() })
              );
            }
            router.push(loginHref);
            setSaved(previousSaved);
            return;
          }
          const data = await res.json().catch(() => ({}));
          throw new Error(data?.error || "Unable to update saved state");
        }
      } catch (err) {
        setSaved(previousSaved);
        const message = err instanceof Error ? err.message : "Unable to update saved state";
        setError(message);
      }
    });
  };

  const accessibleLabel = saved ? "Saved listing" : "Save listing";
  const statusText = loading ? "Saving..." : saved ? "Saved" : "Save property";
  const showFeedback = variant !== "icon";

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      {variant === "icon" ? (
        <button
          type="button"
          onClick={() => handleToggle()}
          disabled={loading}
          aria-pressed={saved}
          aria-label={accessibleLabel}
          title={accessibleLabel}
          className={cn(
            "inline-flex h-9 w-9 items-center justify-center rounded-full border shadow-sm transition",
            saved
              ? "border-rose-200 bg-rose-50 text-rose-600"
              : "border-white/80 bg-white/90 text-slate-600 hover:text-slate-900"
          )}
          data-testid="save-toggle"
        >
          <HeartIcon filled={saved} />
          <span className="sr-only">{accessibleLabel}</span>
        </button>
      ) : (
        <Button
          variant="secondary"
          size="sm"
          onClick={() => handleToggle()}
          disabled={loading}
          aria-pressed={saved}
          data-testid="save-button"
        >
          {statusText}
        </Button>
      )}
      {showFeedback && notice && !error && (
        <p className="text-xs text-slate-600" aria-live="polite">
          {notice}
        </p>
      )}
      {showFeedback && error && (
        <p className="text-xs text-rose-600" aria-live="polite">
          {error}
        </p>
      )}
      {!showFeedback && (notice || error) && (
        <span className="sr-only" aria-live="polite">
          {error || notice}
        </span>
      )}
    </div>
  );
}
