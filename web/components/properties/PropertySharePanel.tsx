"use client";

import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { trackProductEvent } from "@/lib/analytics/product-events.client";
import { formatPropertyShareExpiry } from "@/lib/sharing/property-share";
import {
  buildPropertySignKitPdf,
  buildPropertySignKitShareUrl,
  formatPropertySignKitPrice,
  isPropertySignKitEligible,
  resolvePropertySignKitHeadline,
  sanitizePropertySignKitFileBase,
} from "@/lib/sharing/property-sign-kit";

type ShareResponse = {
  id: string;
  link: string;
  expires_at: string | null;
  revoked_at?: string | null;
};

type Props = {
  propertyId: string;
  listingTitle?: string | null;
  listingStatus?: string | null;
  listingIntent?: string | null;
  isApproved?: boolean | null;
  isActive?: boolean | null;
  locationLabel?: string | null;
  price?: number | null;
  currency?: string | null;
};

function downloadUrl(filename: string, href: string) {
  const link = document.createElement("a");
  link.href = href;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function downloadBytes(filename: string, bytes: Uint8Array, mimeType: string) {
  const copy = Uint8Array.from(bytes);
  const blob = new Blob([copy.buffer as ArrayBuffer], { type: mimeType });
  const href = URL.createObjectURL(blob);
  downloadUrl(filename, href);
  window.setTimeout(() => URL.revokeObjectURL(href), 2_000);
}

export function PropertySharePanel({
  propertyId,
  listingTitle,
  listingStatus,
  listingIntent,
  isApproved,
  isActive,
  locationLabel,
  price,
  currency,
}: Props) {
  const [open, setOpen] = useState(false);
  const [shareId, setShareId] = useState<string | null>(null);
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [trackedCopied, setTrackedCopied] = useState(false);
  const [qrSvg, setQrSvg] = useState<string | null>(null);
  const [qrPngUrl, setQrPngUrl] = useState<string | null>(null);
  const [assetBusy, setAssetBusy] = useState<"sign" | "flyer" | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [trackedEventShareId, setTrackedEventShareId] = useState<string | null>(null);

  const signKitEligible = useMemo(
    () =>
      isPropertySignKitEligible({
        status: listingStatus,
        isApproved,
        isActive,
      }),
    [isActive, isApproved, listingStatus]
  );

  const trackedShareLink = useMemo(
    () => (shareLink && signKitEligible ? buildPropertySignKitShareUrl(shareLink) : null),
    [shareLink, signKitEligible]
  );

  const safeTitle = (listingTitle || "Live listing").trim();
  const safeLocation = (locationLabel || "View full location on PropatyHub").trim();
  const headline = resolvePropertySignKitHeadline(listingIntent);
  const priceLabel = formatPropertySignKitPrice(price, currency);
  const fileBase = sanitizePropertySignKitFileBase(`${safeTitle}-${propertyId.slice(0, 8)}`);

  const loadLink = async (rotate: boolean, purpose: "general" | "sign_kit") => {
    setLoading(true);
    setError(null);
    setCopied(false);
    setTrackedCopied(false);
    try {
      const res = await fetch("/api/share/property", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ propertyId, rotate, purpose }),
      });
      const data = (await res.json().catch(() => null)) as ShareResponse & { error?: string };
      if (!res.ok) {
        setError(data?.error || "Unable to create share link.");
        return;
      }
      setShareId(data.id);
      setShareLink(data.link);
      setExpiresAt(data.expires_at ?? null);
    } catch (err) {
      console.warn("Failed to create share link", err);
      setError("Unable to create share link.");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!shareLink) return;
    try {
      await navigator.clipboard.writeText(shareLink);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  const handleCopyTracked = async () => {
    if (!trackedShareLink) return;
    try {
      await navigator.clipboard.writeText(trackedShareLink);
      setTrackedCopied(true);
    } catch {
      setTrackedCopied(false);
    }
  };

  const handleRotate = async () => {
    if (!shareId) return;
    setLoading(true);
    setError(null);
    setCopied(false);
    setTrackedCopied(false);
    try {
      const res = await fetch(`/api/share/property/${encodeURIComponent(shareId)}/rotate`, {
        method: "POST",
      });
      const data = (await res.json().catch(() => null)) as ShareResponse & { error?: string };
      if (!res.ok) {
        setError(data?.error || "Unable to rotate share link.");
        return;
      }
      setShareId(data.id);
      setShareLink(data.link);
      setExpiresAt(data.expires_at ?? null);
      setTrackedEventShareId(null);
    } catch (err) {
      console.warn("Failed to rotate share link", err);
      setError("Unable to rotate share link.");
    } finally {
      setLoading(false);
    }
  };

  const handleRevoke = async () => {
    if (!shareId) return;
    setLoading(true);
    setError(null);
    setCopied(false);
    setTrackedCopied(false);
    try {
      const res = await fetch(`/api/share/property/${encodeURIComponent(shareId)}/revoke`, {
        method: "POST",
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error || "Unable to revoke share link.");
        return;
      }
      setShareId(null);
      setShareLink(null);
      setExpiresAt(null);
      setQrSvg(null);
      setQrPngUrl(null);
    } catch (err) {
      console.warn("Failed to revoke share link", err);
      setError("Unable to revoke share link.");
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = () => {
    const next = !open;
    setOpen(next);
    if (next && !shareLink) {
      void loadLink(false, signKitEligible ? "sign_kit" : "general");
    }
  };

  useEffect(() => {
    if (!trackedShareLink) {
      setQrSvg(null);
      setQrPngUrl(null);
      return;
    }

    let active = true;
    setQrLoading(true);
    void Promise.all([
      QRCode.toString(trackedShareLink, {
        type: "svg",
        margin: 1,
        width: 256,
        color: { dark: "#0f172a", light: "#ffffff" },
      }),
      QRCode.toDataURL(trackedShareLink, {
        margin: 1,
        width: 900,
        errorCorrectionLevel: "M",
        color: { dark: "#0f172a", light: "#ffffff" },
      }),
    ])
      .then(([svg, pngUrl]) => {
        if (!active) return;
        setQrSvg(svg);
        setQrPngUrl(pngUrl);
      })
      .catch((err) => {
        console.warn("Failed to generate QR assets", err);
        if (!active) return;
        setError("Unable to generate QR sign kit.");
      })
      .finally(() => {
        if (!active) return;
        setQrLoading(false);
      });

    return () => {
      active = false;
    };
  }, [trackedShareLink]);

  useEffect(() => {
    if (!signKitEligible || !shareId || !trackedShareLink || !qrPngUrl) return;
    if (trackedEventShareId === shareId) return;
    trackProductEvent("qr_generated", {
      listingId: propertyId,
      listingStatus: listingStatus ?? null,
      shareChannel: "qr",
    });
    setTrackedEventShareId(shareId);
  }, [listingStatus, propertyId, qrPngUrl, shareId, signKitEligible, trackedEventShareId, trackedShareLink]);

  const handleDownloadQrPng = () => {
    if (!qrPngUrl) return;
    downloadUrl(`${fileBase}-qr.png`, qrPngUrl);
    trackProductEvent("sign_kit_downloaded", {
      listingId: propertyId,
      listingStatus: listingStatus ?? null,
      shareChannel: "qr",
    });
  };

  const handleDownloadPdf = async (template: "sign" | "flyer") => {
    if (!qrPngUrl || assetBusy) return;
    setAssetBusy(template);
    try {
      const bytes = await buildPropertySignKitPdf({
        template,
        qrPngDataUrl: qrPngUrl,
        headline,
        title: safeTitle,
        locationLabel: safeLocation,
        priceLabel,
        trackedShareUrl: trackedShareLink || shareLink || "",
      });
      downloadBytes(
        `${fileBase}-${template === "sign" ? "sign-sheet" : "qr-card"}.pdf`,
        bytes,
        "application/pdf"
      );
      trackProductEvent("sign_kit_downloaded", {
        listingId: propertyId,
        listingStatus: listingStatus ?? null,
        shareChannel: "qr",
      });
    } catch (err) {
      console.warn("Failed to build sign kit PDF", err);
      setError("Unable to download the sign kit right now.");
    } finally {
      setAssetBusy(null);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">Share property</p>
          <p className="text-xs text-slate-600">
            Create a tracked listing link and, for live listings, generate a QR sign kit for offline sharing.
          </p>
        </div>
        <Button size="sm" variant="secondary" onClick={handleToggle} data-testid="property-share-toggle">
          {open ? "Hide" : "Share"}
        </Button>
      </div>
      {open && (
        <div className="mt-3 space-y-5">
          {shareLink ? (
            <div className="space-y-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Private link</p>
                <p className="mt-1 text-xs text-slate-600">Use this controlled PropatyHub link when you want to share the listing directly.</p>
              </div>
              <Input readOnly value={shareLink} className="h-9" />
              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" type="button" onClick={handleCopy} data-testid="property-share-copy-link">
                  {copied ? "Copied" : "Copy private link"}
                </Button>
                <Button size="sm" type="button" variant="secondary" onClick={handleRotate} disabled={loading}>
                  Rotate link
                </Button>
                <Button size="sm" type="button" variant="secondary" onClick={handleRevoke} disabled={loading}>
                  Revoke
                </Button>
              </div>
              <p className="text-xs text-slate-500">{formatPropertyShareExpiry(expiresAt)}</p>
            </div>
          ) : (
            <Button size="sm" type="button" onClick={() => loadLink(false, signKitEligible ? "sign_kit" : "general")} disabled={loading}>
              {loading ? "Generating..." : "Generate link"}
            </Button>
          )}

          {signKitEligible ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4" data-testid="property-sign-kit-panel">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Generate QR sign kit</p>
                  <p className="mt-1 text-xs text-slate-600">
                    Share this listing offline with a tracked PropatyHub QR code. If the listing stops being live, scans fail safely.
                  </p>
                </div>
                {trackedShareLink ? (
                  <Button size="sm" variant="secondary" onClick={handleCopyTracked} data-testid="property-sign-kit-copy-link">
                    {trackedCopied ? "Copied" : "Copy tracked link"}
                  </Button>
                ) : null}
              </div>

              {qrLoading ? (
                <p className="mt-4 text-sm text-slate-600">Preparing QR sign kit…</p>
              ) : trackedShareLink && qrSvg && qrPngUrl ? (
                <div className="mt-4 grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div
                      className="mx-auto max-w-[180px] [&_svg]:h-auto [&_svg]:w-full"
                      dangerouslySetInnerHTML={{ __html: qrSvg }}
                    />
                    <p className="mt-3 text-center text-xs font-semibold text-slate-900">Scan to view this listing</p>
                    <p className="mt-1 text-center text-[11px] text-slate-500">Tracked through a PropatyHub share link.</p>
                  </div>

                  <div className="space-y-3">
                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Sign kit details</p>
                      <div className="mt-2 space-y-1 text-sm text-slate-700">
                        <p className="font-semibold text-slate-900">{safeTitle}</p>
                        <p>{safeLocation}</p>
                        <p className="font-semibold text-sky-700">{priceLabel}</p>
                        <p className="text-xs text-slate-500">{headline} signage only works while the listing remains live on PropatyHub.</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" type="button" onClick={handleDownloadQrPng} data-testid="property-sign-kit-download-qr">
                        Download QR PNG
                      </Button>
                      <Button
                        size="sm"
                        type="button"
                        variant="secondary"
                        onClick={() => void handleDownloadPdf("sign")}
                        disabled={assetBusy !== null}
                        data-testid="property-sign-kit-download-sign"
                      >
                        {assetBusy === "sign" ? "Preparing sign…" : "Download sign kit"}
                      </Button>
                      <Button
                        size="sm"
                        type="button"
                        variant="secondary"
                        onClick={() => void handleDownloadPdf("flyer")}
                        disabled={assetBusy !== null}
                        data-testid="property-sign-kit-download-flyer"
                      >
                        {assetBusy === "flyer" ? "Preparing card…" : "Download QR card"}
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="mt-4 text-sm text-slate-600">Generate a live tracked link to prepare the QR sign kit.</p>
              )}
            </div>
          ) : (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900" data-testid="property-sign-kit-ineligible">
              QR sign kits are available only for live listings. Draft, pending, paused, rejected, removed, and inactive listings stay gated.
            </div>
          )}

          {error && <p className="text-xs text-rose-600">{error}</p>}
        </div>
      )}
    </div>
  );
}
