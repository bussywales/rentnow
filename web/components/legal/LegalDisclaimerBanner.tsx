"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/Button";
import {
  dismissMarketplaceDisclaimer,
  isMarketplaceDisclaimerDismissed,
} from "@/lib/legal/marketplace-disclaimer";

const HIDDEN_PREFIXES = [
  "/auth",
  "/dashboard",
  "/host",
  "/tenant",
  "/admin",
  "/profile",
  "/onboarding",
  "/legal/accept",
];

function shouldHide(pathname: string | null) {
  if (!pathname) return true;
  return HIDDEN_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

const MARKETPLACE_DISCLAIMER_EVENT = "ph:marketplace-disclaimer";

export function LegalDisclaimerBanner() {
  const pathname = usePathname();
  const [persistedDismissed, setPersistedDismissed] = useState<boolean | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const refresh = () => setPersistedDismissed(isMarketplaceDisclaimerDismissed(window.localStorage));
    refresh();
    window.addEventListener("storage", refresh);
    window.addEventListener(MARKETPLACE_DISCLAIMER_EVENT, refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener(MARKETPLACE_DISCLAIMER_EVENT, refresh);
    };
  }, []);

  if (
    shouldHide(pathname) ||
    persistedDismissed === null ||
    persistedDismissed
  ) {
    return null;
  }

  const handleDismiss = () => {
    if (typeof window !== "undefined") {
      dismissMarketplaceDisclaimer(window.localStorage);
      window.dispatchEvent(new Event(MARKETPLACE_DISCLAIMER_EVENT));
    }
    setPersistedDismissed(true);
  };

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-slate-900 text-white"
      data-testid="legal-disclaimer-banner"
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-semibold">Marketplace disclaimer</p>
          <p className="text-xs text-slate-200">
            PropatyHub is a marketplace. Listings are provided by independent hosts and agents.
            Verify details directly before making commitments.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            onClick={handleDismiss}
            aria-label="Dismiss marketplace disclaimer"
            className="focus-visible:ring-sky-300"
          >
            Got it
          </Button>
          <Link href="/legal/disclaimer" className="text-xs font-semibold text-slate-100 hover:text-white">
            Learn more
          </Link>
          <Link href="/legal">
            <Button size="sm" variant="secondary">
              View terms
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
