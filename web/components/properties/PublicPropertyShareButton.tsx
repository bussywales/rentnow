"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/components/ui/cn";
import {
  buildPropertyPublicShareUrl,
  buildPropertyWhatsappShareUrl,
  type PropertyShareChannel,
  type PropertyShareSurface,
} from "@/lib/properties/public-share";

type Props = {
  propertyId: string;
  surface: PropertyShareSurface;
  variant?: "icon" | "button";
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

export function PublicPropertyShareButton({
  propertyId,
  surface,
  variant = "icon",
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

  const getShareUrl = () => {
    const origin =
      typeof window !== "undefined" && window.location?.origin
        ? window.location.origin
        : "https://www.propatyhub.com";
    return buildPropertyPublicShareUrl(propertyId, origin);
  };

  const logShare = async (channel: PropertyShareChannel) => {
    try {
      await fetch(`/api/properties/${encodeURIComponent(propertyId)}/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel,
          surface,
        }),
      });
    } catch {
      // Share should still work even if analytics logging fails.
    }
  };

  const onCopyLink = async () => {
    const url = getShareUrl();
    try {
      await navigator.clipboard.writeText(url);
      setNotice("Link copied.");
    } catch {
      setNotice("Copy failed.");
    }
    setMenuOpen(false);
    void logShare("copy");
  };

  const onWhatsapp = () => {
    const shareUrl = getShareUrl();
    const whatsappUrl = buildPropertyWhatsappShareUrl(shareUrl);
    window.open(whatsappUrl, "_blank", "noopener,noreferrer");
    setNotice("Opening WhatsApp...");
    setMenuOpen(false);
    void logShare("whatsapp");
  };

  const onNativeShare = async () => {
    const shareUrl = getShareUrl();
    try {
      if (navigator.share) {
        await navigator.share({
          title: "PropatyHub listing",
          text: "Take a look at this property on PropatyHub.",
          url: shareUrl,
        });
        setNotice("Shared.");
      } else {
        setNotice("Sharing is unavailable.");
      }
    } catch {
      // Ignore cancellation.
    }
    setMenuOpen(false);
    void logShare("native");
  };

  const actionButton =
    variant === "button" ? (
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className={cn("gap-1.5", className)}
        onClick={() => setMenuOpen((prev) => !prev)}
        aria-label="Share listing"
        data-testid={`property-share-${surface}`}
      >
        <ShareIcon />
        Share
      </Button>
    ) : (
      <button
        type="button"
        className={cn(
          "inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/95 text-slate-700 shadow-sm ring-1 ring-slate-200 transition hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500",
          className
        )}
        onClick={() => setMenuOpen((prev) => !prev)}
        aria-label="Share listing"
        data-testid={`property-share-${surface}`}
      >
        <ShareIcon />
      </button>
    );

  return (
    <div ref={rootRef} className="relative">
      {actionButton}
      {menuOpen && (
        <div className="absolute right-0 top-full z-30 mt-2 w-40 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg">
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
      {notice && variant === "button" && (
        <p className="pointer-events-none absolute left-0 top-full mt-1 text-xs text-slate-500">
          {notice}
        </p>
      )}
    </div>
  );
}
