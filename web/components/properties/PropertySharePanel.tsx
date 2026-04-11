"use client";

import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { PropertySignKitModal } from "@/components/properties/PropertySignKitModal";
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

type PreviewMode = "sign" | "flyer" | "qr";

const PREVIEW_OPTIONS: Array<{ value: PreviewMode; label: string; hint: string }> = [
  { value: "sign", label: "Sign kit", hint: "Primary printable sheet" },
  { value: "flyer", label: "QR card", hint: "Compact handout" },
  { value: "qr", label: "QR only", hint: "Standalone code" },
];

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
  const [signKitOpen, setSignKitOpen] = useState(false);
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
  const [previewMode, setPreviewMode] = useState<PreviewMode>("sign");

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
  const previewTitle =
    previewMode === "sign"
      ? "Street-facing sign preview"
      : previewMode === "flyer"
        ? "Compact QR card preview"
        : "Standalone QR preview";

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
      setSignKitOpen(false);
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

  const handleOpenSignKit = () => {
    setSignKitOpen(true);
    if (!shareLink) {
      void loadLink(false, "sign_kit");
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

  const handlePrimaryDownload = () => {
    if (previewMode === "qr") {
      handleDownloadQrPng();
      return;
    }
    void handleDownloadPdf(previewMode);
  };

  const primaryDownloadLabel =
    previewMode === "sign"
      ? assetBusy === "sign"
        ? "Preparing sign kit…"
        : "Download sign kit"
      : previewMode === "flyer"
        ? assetBusy === "flyer"
          ? "Preparing QR card…"
          : "Download QR card"
        : "Download QR PNG";

  return (
    <div className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-slate-900">Share property</p>
          <p className="max-w-2xl text-xs text-slate-600 sm:text-sm">
            Generate a controlled listing link and, for live listings, a premium QR sign kit for offline sharing.
          </p>
        </div>
        <Button size="sm" variant="secondary" onClick={handleToggle} data-testid="property-share-toggle">
          {open ? "Hide" : "Share"}
        </Button>
      </div>
      {open && (
        <div className="mt-5 space-y-5">
          {shareLink ? (
            <section className="rounded-3xl border border-slate-200 bg-slate-50/80 p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="max-w-xl space-y-1">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Tracked listing link</p>
                  <p className="text-sm font-semibold text-slate-900">Private share controls</p>
                  <p className="text-sm text-slate-600">
                    Use this controlled PropatyHub link for direct sharing. Rotate or revoke it at any time.
                  </p>
                </div>
                <p className="text-xs text-slate-500">{formatPropertyShareExpiry(expiresAt)}</p>
              </div>
              <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
                <Input readOnly value={shareLink} className="h-11 bg-white" />
                <div className="flex flex-wrap gap-2">
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
              </div>
            </section>
          ) : (
            <Button size="sm" type="button" onClick={() => loadLink(false, signKitEligible ? "sign_kit" : "general")} disabled={loading}>
              {loading ? "Generating..." : "Generate link"}
            </Button>
          )}

          {signKitEligible ? (
            <section
              className="rounded-[32px] border border-slate-200 bg-[linear-gradient(180deg,#f8fbff_0%,#eef5ff_100%)] p-4 shadow-[0_20px_50px_rgba(15,23,42,0.08)] sm:p-5"
              data-testid="property-sign-kit-panel"
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div className="max-w-xl space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-700">Listing marketing infrastructure</p>
                  <div>
                    <h3 className="text-lg font-semibold text-slate-950 sm:text-xl">Generate QR sign kit</h3>
                    <p className="mt-1 text-sm text-slate-600">
                      Open the dedicated sign-kit surface to review the tracked QR, switch formats, and export a printable asset.
                    </p>
                  </div>
                </div>
                <Button
                  size="md"
                  type="button"
                  onClick={handleOpenSignKit}
                  disabled={loading}
                  className="w-full sm:w-auto"
                  data-testid="property-sign-kit-open"
                >
                  {loading && !shareLink ? "Preparing…" : "Open QR sign kit"}
                </Button>
              </div>
              <div className="mt-4 rounded-2xl border border-slate-200/80 bg-white/80 px-4 py-3 text-sm text-slate-600">
                This QR only resolves to the live property page while the listing remains active.
              </div>
            </section>
          ) : (
            <div className="rounded-3xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900" data-testid="property-sign-kit-ineligible">
              QR sign kits are available only for live listings. Draft, pending, paused, rejected, removed, and inactive listings stay gated.
            </div>
          )}

          {error && <p className="text-xs text-rose-600">{error}</p>}
        </div>
      )}

      <PropertySignKitModal
        open={signKitOpen}
        onOpenChange={setSignKitOpen}
        previewMode={previewMode}
        onPreviewModeChange={setPreviewMode}
        previewOptions={PREVIEW_OPTIONS}
        qrLoading={qrLoading}
        qrSvg={qrSvg}
        trackedShareLink={trackedShareLink}
        trackedCopied={trackedCopied}
        onCopyTracked={handleCopyTracked}
        onPrimaryDownload={handlePrimaryDownload}
        onDownloadSign={() => void handleDownloadPdf("sign")}
        onDownloadFlyer={() => void handleDownloadPdf("flyer")}
        onDownloadQr={handleDownloadQrPng}
        primaryDownloadLabel={primaryDownloadLabel}
        assetBusy={assetBusy}
        previewTitle={previewTitle}
        headline={headline}
        title={safeTitle}
        locationLabel={safeLocation}
        priceLabel={priceLabel}
        error={error}
      />
    </div>
  );
}
