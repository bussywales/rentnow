"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { LEGAL_AUDIENCE_LABELS, type LegalAudience } from "@/lib/legal/constants";

type StatusResponse = {
  ok: boolean;
  is_complete?: boolean;
  missing_audiences?: string[];
};

const HIDDEN_PREFIXES = ["/auth", "/legal", "/onboarding"];

function shouldHide(pathname: string | null) {
  if (!pathname) return true;
  return HIDDEN_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export function LegalAcceptanceModalGate() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const currentUrl = useMemo(() => {
    const query = searchParams?.toString();
    return query ? `${pathname}?${query}` : pathname || "/";
  }, [pathname, searchParams]);

  useEffect(() => {
    if (shouldHide(pathname)) {
      setLoading(false);
      return;
    }
    let mounted = true;
    setLoading(true);
    fetch("/api/legal/accept/status", { cache: "no-store" })
      .then(async (res) => {
        if (!mounted) return;
        if (!res.ok) {
          setStatus(null);
          return;
        }
        const data = (await res.json().catch(() => null)) as StatusResponse | null;
        setStatus(data);
      })
      .catch(() => {
        if (mounted) setStatus(null);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [pathname]);

  if (loading || shouldHide(pathname)) return null;
  if (!status || status.is_complete) return null;

  const missing = status.missing_audiences?.length
    ? status.missing_audiences
        .map((audience) => {
          const label = LEGAL_AUDIENCE_LABELS[audience as LegalAudience];
          return label || audience;
        })
        .join(", ")
    : "required terms";

  const handleReview = () => {
    router.push(`/legal/accept?redirect=${encodeURIComponent(currentUrl || "/")}`);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="legal-acceptance-title"
      data-testid="legal-acceptance-modal"
    >
      <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="border-b border-slate-200 px-4 py-3">
          <p id="legal-acceptance-title" className="text-sm font-semibold text-slate-900">
            Review required
          </p>
          <p className="text-xs text-slate-600">
            Please review and accept the latest terms and marketplace disclaimer to continue.
          </p>
        </div>
        <div className="space-y-3 px-4 py-4 text-sm text-slate-700">
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            Missing: {missing}
          </p>
          <p className="text-xs text-slate-600">
            You can read the full disclaimer in the{" "}
            <Link href="/legal/disclaimer" className="font-semibold text-sky-700 hover:underline">
              Disclaimer
            </Link>{" "}
            section.
          </p>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-4 py-3">
          <Button size="sm" onClick={handleReview}>
            Review & accept
          </Button>
        </div>
      </div>
    </div>
  );
}
