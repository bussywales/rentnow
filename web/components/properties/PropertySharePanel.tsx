"use client";

import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { cn } from "@/components/ui/cn";
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
              className="overflow-hidden rounded-[32px] border border-slate-200 bg-[linear-gradient(180deg,#f8fbff_0%,#eef5ff_100%)] shadow-[0_20px_50px_rgba(15,23,42,0.08)]"
              data-testid="property-sign-kit-panel"
            >
              <div className="border-b border-slate-200/80 bg-white/70 px-4 py-4 backdrop-blur sm:px-6 sm:py-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                  <div className="max-w-2xl space-y-2">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-700">Listing marketing infrastructure</p>
                    <div>
                      <h3 className="text-lg font-semibold text-slate-950 sm:text-xl">Generate QR sign kit</h3>
                      <p className="mt-1 text-sm text-slate-600 sm:text-[15px]">
                        Share this listing offline with a tracked PropatyHub QR code. Scans land on the live listing while it stays active and fail safely when it does not.
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {PREVIEW_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setPreviewMode(option.value)}
                        className={cn(
                          "rounded-full border px-3 py-2 text-xs font-semibold transition sm:text-sm",
                          previewMode === option.value
                            ? "border-slate-900 bg-slate-900 text-white shadow-sm"
                            : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900"
                        )}
                        aria-pressed={previewMode === option.value}
                        data-testid={`property-sign-kit-preview-${option.value}`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {qrLoading ? (
                <div className="px-4 py-10 text-sm text-slate-600 sm:px-6">Preparing QR sign kit…</div>
              ) : trackedShareLink && qrSvg && qrPngUrl ? (
                <div className="grid gap-6 px-4 py-5 sm:px-6 lg:grid-cols-[minmax(0,1.2fr)_360px] lg:items-start">
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{previewTitle}</p>
                        <p className="text-xs text-slate-500 sm:text-sm">Choose a format, review the asset, then export the version you need.</p>
                      </div>
                      <p className="rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-[11px] font-medium text-slate-500 sm:text-xs">
                        {PREVIEW_OPTIONS.find((option) => option.value === previewMode)?.hint}
                      </p>
                    </div>

                    <div className="rounded-[28px] border border-white/70 bg-[radial-gradient(circle_at_top,#ffffff_0%,#eff6ff_58%,#e2ecfb_100%)] p-4 shadow-inner sm:p-6">
                      {previewMode === "sign" ? (
                        <div className="mx-auto max-w-[760px] rounded-[28px] border border-slate-200 bg-white shadow-[0_24px_60px_rgba(15,23,42,0.14)]">
                          <div className="rounded-t-[28px] bg-slate-950 px-5 py-5 text-white sm:px-7 sm:py-6">
                            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sky-200">PropatyHub</p>
                            <p className="mt-3 text-2xl font-semibold uppercase tracking-[0.08em] sm:text-4xl">{headline}</p>
                          </div>
                          <div className="grid gap-6 p-5 sm:grid-cols-[minmax(0,1fr)_220px] sm:p-7">
                            <div className="space-y-4">
                              <div>
                                <p className="text-xl font-semibold text-slate-950 sm:text-3xl">{safeTitle}</p>
                                <p className="mt-2 max-w-xl text-sm text-slate-600 sm:text-base">{safeLocation}</p>
                              </div>
                              <p className="text-lg font-semibold text-sky-700 sm:text-2xl">{priceLabel}</p>
                              <p className="text-xs text-slate-500 sm:text-sm">
                                Scans open the live PropatyHub listing while this property remains active.
                              </p>
                            </div>
                            <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4 shadow-sm">
                              <div
                                className="mx-auto aspect-square max-w-[180px] [&_svg]:h-auto [&_svg]:w-full"
                                dangerouslySetInnerHTML={{ __html: qrSvg }}
                              />
                              <p className="mt-3 text-center text-xs font-semibold text-slate-900 sm:text-sm">Scan to view this listing</p>
                              <p className="mt-1 text-center text-[11px] text-slate-500">Tracked through a PropatyHub share link</p>
                            </div>
                          </div>
                        </div>
                      ) : previewMode === "flyer" ? (
                        <div className="mx-auto max-w-[520px] rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_24px_60px_rgba(15,23,42,0.14)] sm:p-6">
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-700">{headline}</p>
                              <p className="mt-2 text-xl font-semibold text-slate-950">{safeTitle}</p>
                              <p className="mt-2 text-sm text-slate-600">{safeLocation}</p>
                            </div>
                            <p className="text-base font-semibold text-sky-700">{priceLabel}</p>
                          </div>
                          <div className="mt-5 grid gap-4 sm:grid-cols-[150px_minmax(0,1fr)] sm:items-center">
                            <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-3 shadow-sm">
                              <div
                                className="mx-auto aspect-square max-w-[130px] [&_svg]:h-auto [&_svg]:w-full"
                                dangerouslySetInnerHTML={{ __html: qrSvg }}
                              />
                            </div>
                            <div className="space-y-2">
                              <p className="text-sm font-semibold text-slate-900">Window, counter, or handout format</p>
                              <p className="text-sm text-slate-600">
                                Use this compact card when you need a cleaner asset than the full sign sheet.
                              </p>
                              <p className="text-xs text-slate-500">The QR remains tied to the tracked PropatyHub listing link.</p>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="mx-auto flex max-w-[420px] flex-col items-center rounded-[28px] border border-slate-200 bg-white p-6 text-center shadow-[0_24px_60px_rgba(15,23,42,0.14)] sm:p-8">
                          <div className="w-full max-w-[220px] rounded-[28px] border border-slate-200 bg-slate-50 p-4 shadow-sm">
                            <div
                              className="mx-auto aspect-square max-w-[180px] [&_svg]:h-auto [&_svg]:w-full"
                              dangerouslySetInnerHTML={{ __html: qrSvg }}
                            />
                          </div>
                          <p className="mt-5 text-lg font-semibold text-slate-950">Standalone QR asset</p>
                          <p className="mt-2 text-sm text-slate-600">
                            Best when you only need the tracked QR image for another print layout.
                          </p>
                          <p className="mt-3 text-xs text-slate-500">No raw listing URL. This always routes through the controlled PropatyHub share path.</p>
                        </div>
                      )}
                    </div>
                  </div>

                  <aside className="space-y-4 rounded-[28px] border border-slate-200 bg-white/90 p-4 shadow-[0_16px_40px_rgba(15,23,42,0.08)] backdrop-blur sm:p-5">
                    <div className="space-y-3">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Export</p>
                        <p className="mt-1 text-base font-semibold text-slate-950">Download the selected asset</p>
                      </div>
                      <Button
                        size="md"
                        type="button"
                        onClick={handlePrimaryDownload}
                        disabled={previewMode !== "qr" && assetBusy !== null}
                        className="w-full"
                        data-testid={
                          previewMode === "sign"
                            ? "property-sign-kit-download-sign"
                            : previewMode === "flyer"
                              ? "property-sign-kit-download-flyer"
                              : "property-sign-kit-download-qr"
                        }
                      >
                        {primaryDownloadLabel}
                      </Button>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <Button
                          size="sm"
                          type="button"
                          variant="secondary"
                          onClick={() => void handleDownloadPdf("sign")}
                          disabled={assetBusy !== null}
                        >
                          {assetBusy === "sign" ? "Preparing…" : "Sign sheet PDF"}
                        </Button>
                        <Button
                          size="sm"
                          type="button"
                          variant="secondary"
                          onClick={() => void handleDownloadPdf("flyer")}
                          disabled={assetBusy !== null}
                        >
                          {assetBusy === "flyer" ? "Preparing…" : "QR card PDF"}
                        </Button>
                      </div>
                      <Button
                        size="sm"
                        type="button"
                        variant="ghost"
                        onClick={handleDownloadQrPng}
                        className="w-full justify-start"
                      >
                        Download QR PNG
                      </Button>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-sm font-semibold text-slate-900">Tracked link</p>
                      <p className="mt-1 text-xs text-slate-500">Copy the QR-linked PropatyHub URL for WhatsApp, email, or print notes.</p>
                      <div className="mt-3 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 break-all">
                        {trackedShareLink}
                      </div>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={handleCopyTracked}
                        className="mt-3 w-full"
                        data-testid="property-sign-kit-copy-link"
                      >
                        {trackedCopied ? "Copied" : "Copy tracked link"}
                      </Button>
                    </div>

                    <div className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4 text-sm text-slate-600">
                      <p className="font-medium text-slate-900">Live listing safeguard</p>
                      <p className="mt-1">
                        This QR only resolves to the live property page while the listing remains active on PropatyHub.
                      </p>
                    </div>
                  </aside>
                </div>
              ) : (
                <div className="px-4 py-10 text-sm text-slate-600 sm:px-6">Generate a live tracked link to prepare the QR sign kit.</div>
              )}
            </section>
          ) : (
            <div className="rounded-3xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900" data-testid="property-sign-kit-ineligible">
              QR sign kits are available only for live listings. Draft, pending, paused, rejected, removed, and inactive listings stay gated.
            </div>
          )}

          {error && <p className="text-xs text-rose-600">{error}</p>}
        </div>
      )}
    </div>
  );
}
