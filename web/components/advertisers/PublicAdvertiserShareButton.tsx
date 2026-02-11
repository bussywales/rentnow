"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/components/ui/cn";
import {
  getPublicProfileUrl,
  getWhatsAppProfileShareUrl,
  type AdvertiserShareChannel,
  type AdvertiserShareSurface,
} from "@/lib/advertisers/public-share";

type Props = {
  advertiserId: string;
  slug: string;
  displayName?: string | null;
  surface?: AdvertiserShareSurface;
  className?: string;
};

function ShareIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("h-4 w-4", className)}
    >
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <path d="M8.7 10.7l6.6-3.5" />
      <path d="M8.7 13.3l6.6 3.5" />
    </svg>
  );
}

export function PublicAdvertiserShareButton({
  advertiserId,
  slug,
  displayName,
  surface = "agent_profile",
  className,
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const canNativeShare = useMemo(() => {
    if (typeof navigator === "undefined") return false;
    return typeof navigator.share === "function";
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (!rootRef.current?.contains(target)) {
        setMenuOpen(false);
      }
    };
    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, [menuOpen]);

  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(null), 1800);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  const getOrigin = () =>
    typeof window !== "undefined" && window.location?.origin
      ? window.location.origin
      : "https://www.propatyhub.com";

  const getProfileUrl = () => getPublicProfileUrl(getOrigin(), slug);

  const logShare = async (channel: AdvertiserShareChannel) => {
    try {
      await fetch(`/api/advertisers/${encodeURIComponent(advertiserId)}/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel,
          surface,
        }),
      });
    } catch {
      // Sharing should still succeed if telemetry fails.
    }
  };

  const onCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(getProfileUrl());
      setNotice("Link copied.");
    } catch {
      setNotice("Copy failed.");
    }
    setMenuOpen(false);
    void logShare("copy");
  };

  const onWhatsapp = () => {
    const whatsappUrl = getWhatsAppProfileShareUrl(
      getOrigin(),
      slug,
      displayName
    );
    window.open(whatsappUrl, "_blank", "noopener,noreferrer");
    setNotice("Opening WhatsApp...");
    setMenuOpen(false);
    void logShare("whatsapp");
  };

  const onNativeShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: displayName?.trim() || "PropatyHub advertiser",
          text: "View this advertiser's listings on PropatyHub.",
          url: getProfileUrl(),
        });
        setNotice("Shared.");
      }
    } catch {
      // Ignore cancellation.
    }
    setMenuOpen(false);
    void logShare("native");
  };

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="gap-1.5"
        onClick={() => setMenuOpen((prev) => !prev)}
        aria-label="Share profile"
        data-testid="advertiser-share-button"
      >
        <ShareIcon />
        Share profile
      </Button>
      {menuOpen && (
        <div className="absolute right-0 top-full z-30 mt-2 w-44 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg">
          <button
            type="button"
            className="flex w-full items-center rounded-lg px-2.5 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
            onClick={onCopyLink}
          >
            Copy link
          </button>
          <button
            type="button"
            className="flex w-full items-center rounded-lg px-2.5 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
            onClick={onWhatsapp}
          >
            WhatsApp
          </button>
          {canNativeShare && (
            <button
              type="button"
              className="flex w-full items-center rounded-lg px-2.5 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
              onClick={onNativeShare}
            >
              Share...
            </button>
          )}
        </div>
      )}
      {notice && (
        <p className="pointer-events-none absolute left-0 top-full mt-1 text-xs text-slate-500">
          {notice}
        </p>
      )}
    </div>
  );
}
