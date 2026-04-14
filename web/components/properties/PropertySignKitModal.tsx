"use client";

import Image from "next/image";
import { useEffect, useId, useMemo, useRef, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { cn } from "@/components/ui/cn";
import { focusFirstTarget, trapFocusWithinContainer } from "@/lib/a11y/focus";

type PreviewMode = "sign" | "flyer" | "qr";

type PreviewOption = {
  value: PreviewMode;
  label: string;
  hint: string;
};

type PropertySignKitModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  previewMode: PreviewMode;
  onPreviewModeChange: (mode: PreviewMode) => void;
  showPriceOnExport: boolean;
  onShowPriceOnExportChange: (next: boolean) => void;
  previewOptions: PreviewOption[];
  qrLoading: boolean;
  qrSvg: string | null;
  trackedShareLink: string | null;
  trackedCopied: boolean;
  onCopyTracked: () => void;
  onPrimaryDownload: () => void;
  onDownloadSign: () => void;
  onDownloadFlyer: () => void;
  onDownloadQr: () => void;
  primaryDownloadLabel: string;
  assetBusy: "sign" | "flyer" | null;
  previewTitle: string;
  headline: string;
  title: string;
  locationLabel: string;
  priceLabel: string;
  error?: string | null;
};

function PreviewCanvas({
  previewMode,
  qrSvg,
  headline,
  title,
  locationLabel,
  priceLabel,
  showPrice,
}: {
  previewMode: PreviewMode;
  qrSvg: string;
  headline: string;
  title: string;
  locationLabel: string;
  priceLabel: string;
  showPrice: boolean;
}) {
  if (previewMode === "sign") {
    return (
      <div className="mx-auto max-w-[760px] overflow-hidden rounded-[18px] border border-slate-200 bg-white shadow-[0_28px_70px_rgba(15,23,42,0.16)]">
        <div className="flex items-end justify-between gap-6 bg-slate-950 px-6 py-5 text-white sm:px-8 sm:py-6">
          <p className="text-5xl font-semibold uppercase tracking-[0.03em] sm:text-6xl">{headline}</p>
          <div className="flex w-[110px] shrink-0 flex-col items-center text-center">
            <Image
              src="/brand/propatyhub-sign-kit-mark.png"
              alt="PropatyHub"
              className="h-20 w-20 object-contain sm:h-24 sm:w-24"
              width={96}
              height={96}
            />
            <p className="mt-2 text-xl font-semibold leading-none text-white">PropatyHub</p>
            <p className="mt-1 text-[11px] leading-none text-sky-100">www.propatyhub.com</p>
          </div>
        </div>
        <div className="px-6 py-6 sm:px-8 sm:py-8">
          <div className="space-y-1.5 pt-2">
            <p className="max-w-2xl text-3xl font-semibold leading-tight text-slate-950 sm:text-[2.9rem]">{title}</p>
            <p className="max-w-2xl text-base leading-7 text-slate-500 sm:text-lg">{locationLabel}</p>
            {showPrice ? <p className="pt-1 text-3xl font-semibold leading-none text-sky-700 sm:text-[2.55rem]">{priceLabel}</p> : null}
          </div>
          <div className="mt-6 rounded-[6px] border border-slate-200 bg-[#f3f8fe] p-5 sm:p-6">
            <div className="mx-auto max-w-[430px] rounded-[4px] bg-white p-5 shadow-[0_8px_20px_rgba(15,23,42,0.08)] sm:p-6">
              <div className="mx-auto aspect-square max-w-[330px] [&_svg]:h-auto [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: qrSvg }} />
            </div>
            <div className="mt-5 text-center">
              <p className="text-lg font-semibold text-slate-950">Scan for full details</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">Open the live listing on PropatyHub</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (previewMode === "flyer") {
    return (
      <div className="mx-auto max-w-[720px] overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-[0_28px_70px_rgba(15,23,42,0.16)]">
        <div className="bg-slate-950 px-6 py-4 text-white sm:px-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-sky-200">PropatyHub</p>
        </div>
        <div className="grid items-stretch gap-5 px-6 py-6 sm:grid-cols-[minmax(0,1fr)_235px] sm:px-8 sm:py-8">
          <div className="flex min-h-[250px] flex-col">
            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-full bg-slate-950 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white">
                {headline}
              </span>
              {showPrice ? <span className="text-lg font-semibold text-sky-700">{priceLabel}</span> : null}
            </div>
            <p className="mt-5 text-2xl font-semibold leading-tight text-slate-950 sm:text-[2rem]">{title}</p>
            <p className="mt-3 max-w-xl text-sm leading-6 text-slate-600 sm:text-base">{locationLabel}</p>
            <p className="mt-auto pt-8 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Compact listing collateral</p>
          </div>
          <div className="rounded-[28px] border border-slate-200 bg-[linear-gradient(180deg,#f7faff_0%,#eef5ff_100%)] p-4 shadow-sm">
            <div className="rounded-[24px] border border-slate-200 bg-white p-4">
              <div className="mx-auto aspect-square max-w-[165px] [&_svg]:h-auto [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: qrSvg }} />
              <p className="mt-4 text-center text-sm font-semibold text-slate-950">Scan for full details</p>
              <p className="mt-1 text-center text-xs leading-5 text-slate-500">Open the live listing on PropatyHub.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-[420px] flex-col items-center rounded-[32px] border border-slate-200 bg-white px-8 py-8 text-center shadow-[0_28px_70px_rgba(15,23,42,0.16)] sm:px-10 sm:py-10">
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-sky-700">PropatyHub QR only</p>
      <div className="mt-5 w-full max-w-[260px] rounded-[28px] border border-slate-200 bg-slate-50 p-5 shadow-sm">
        <div className="mx-auto aspect-square max-w-[210px] [&_svg]:h-auto [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: qrSvg }} />
      </div>
      <p className="mt-6 text-xl font-semibold text-slate-950">Standalone QR asset</p>
      <p className="mt-3 max-w-sm text-sm leading-6 text-slate-600">Minimal, clean, and ready to place into an existing print layout.</p>
    </div>
  );
}

function PropertySignKitModalBody({
  previewMode,
  onPreviewModeChange,
  showPriceOnExport,
  onShowPriceOnExportChange,
  previewOptions,
  qrLoading,
  qrSvg,
  trackedShareLink,
  trackedCopied,
  onCopyTracked,
  onPrimaryDownload,
  onDownloadSign,
  onDownloadFlyer,
  onDownloadQr,
  primaryDownloadLabel,
  assetBusy,
  previewTitle,
  headline,
  title,
  locationLabel,
  priceLabel,
  error,
}: Omit<PropertySignKitModalProps, "open" | "onOpenChange">) {
  const selectedOption = useMemo(
    () => previewOptions.find((option) => option.value === previewMode) ?? previewOptions[0],
    [previewMode, previewOptions]
  );

  if (qrLoading) {
    return <div className="px-1 py-10 text-sm text-slate-600">Preparing QR sign kit…</div>;
  }

  if (!trackedShareLink || !qrSvg) {
    return <div className="px-1 py-10 text-sm text-slate-600">Generate a live tracked link to prepare the QR sign kit.</div>;
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_360px] lg:items-start xl:gap-8">
      <section className="space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-950">{previewTitle}</p>
            <p className="mt-1 text-sm text-slate-500">Review the selected asset at a readable scale before you export it.</p>
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            {previewOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => onPreviewModeChange(option.value)}
                className={cn(
                  "min-w-[118px] rounded-[20px] border px-3 py-3 text-left text-xs transition sm:text-sm",
                  previewMode === option.value
                    ? "border-slate-900 bg-slate-900 text-white shadow-sm"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900"
                )}
                aria-pressed={previewMode === option.value}
                data-testid={`property-sign-kit-preview-${option.value}`}
              >
                <span className="block font-semibold">{option.label}</span>
                <span className={cn("mt-1 block text-[11px] leading-5", previewMode === option.value ? "text-slate-300" : "text-slate-500")}>
                  {option.hint}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-[32px] border border-slate-200 bg-[radial-gradient(circle_at_top,#ffffff_0%,#eff6ff_60%,#e1ebfb_100%)] p-4 shadow-inner sm:p-6">
          <PreviewCanvas
            previewMode={previewMode}
            qrSvg={qrSvg}
            headline={headline}
            title={title}
            locationLabel={locationLabel}
            priceLabel={priceLabel}
            showPrice={showPriceOnExport}
          />
        </div>
      </section>

      <aside className="space-y-4 rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_40px_rgba(15,23,42,0.08)]">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Selected format</p>
          <p className="mt-1 text-lg font-semibold text-slate-950">{selectedOption.label}</p>
          <p className="mt-1 text-sm text-slate-600">{selectedOption.hint}</p>
        </div>

        <div className="space-y-3 rounded-[24px] border border-slate-200 bg-slate-50 p-4">
          <label className="flex items-start gap-3 rounded-[18px] border border-slate-200 bg-white px-3 py-3">
            <input
              type="checkbox"
              checked={showPriceOnExport}
              onChange={(event) => onShowPriceOnExportChange(event.target.checked)}
              className="mt-1 h-4 w-4 rounded border-slate-300 text-slate-950 focus:ring-slate-900"
            />
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-slate-950">Show price on export</span>
              <span className="mt-1 block text-xs leading-5 text-slate-500">Affects preview and PDF exports only.</span>
            </span>
          </label>
          <p className="text-sm font-semibold text-slate-900">Export selected format</p>
          <p className="text-xs text-slate-500">Use the primary export for the preview you are looking at. Alternate formats stay available below.</p>
          <Button
            size="md"
            type="button"
            onClick={onPrimaryDownload}
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
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Also export</p>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              <Button size="sm" type="button" variant="secondary" onClick={onDownloadSign} disabled={assetBusy !== null} className="w-full whitespace-nowrap">
                {assetBusy === "sign" ? "Preparing…" : "Sign sheet PDF"}
              </Button>
              <Button size="sm" type="button" variant="secondary" onClick={onDownloadFlyer} disabled={assetBusy !== null} className="w-full whitespace-nowrap">
                {assetBusy === "flyer" ? "Preparing…" : "QR card PDF"}
              </Button>
            </div>
            <Button size="sm" type="button" variant="ghost" onClick={onDownloadQr} className="w-full justify-center border border-transparent text-slate-700 hover:border-slate-200 hover:bg-white">
              Download QR PNG
            </Button>
          </div>
        </div>

        <div className="space-y-3 rounded-[24px] border border-slate-200 bg-white p-4">
          <div>
            <p className="text-sm font-semibold text-slate-900">Tracked link</p>
            <p className="mt-1 text-xs text-slate-500">Use this controlled PropatyHub URL in WhatsApp, email, print notes, or manual handoff copy.</p>
          </div>
          <div className="rounded-[20px] border border-slate-200 bg-slate-50 px-3 py-3 text-xs leading-5 text-slate-600 break-all">
            {trackedShareLink}
          </div>
          <Button
            size="sm"
            variant="secondary"
            onClick={onCopyTracked}
            className="w-full"
            data-testid="property-sign-kit-copy-link"
          >
            {trackedCopied ? "Copied" : "Copy tracked link"}
          </Button>
        </div>

        <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
          <p className="font-semibold text-slate-900">Live listing safeguard</p>
          <p className="mt-1">This QR only resolves to the live property page while the listing remains active on PropatyHub.</p>
        </div>

        {error ? <p className="text-xs text-rose-600">{error}</p> : null}
      </aside>
    </div>
  );
}

export function PropertySignKitModal(props: PropertySignKitModalProps) {
  const {
    open,
    onOpenChange,
    previewMode,
    onPreviewModeChange,
    showPriceOnExport,
    onShowPriceOnExportChange,
    previewOptions,
    qrLoading,
    qrSvg,
    trackedShareLink,
    trackedCopied,
    onCopyTracked,
    onPrimaryDownload,
    onDownloadSign,
    onDownloadFlyer,
    onDownloadQr,
    primaryDownloadLabel,
    assetBusy,
    previewTitle,
    headline,
    title,
    locationLabel,
    priceLabel,
    error,
  } = props;

  const titleId = useId();
  const descriptionId = useId();
  const panelRef = useRef<HTMLDivElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;

    previousFocusRef.current = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const rafId = window.requestAnimationFrame(() => {
      focusFirstTarget(panelRef.current);
    });

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onOpenChange(false);
        return;
      }
      trapFocusWithinContainer(event, panelRef.current);
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.cancelAnimationFrame(rafId);
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocusRef.current?.focus();
    };
  }, [open, onOpenChange]);

  const content: ReactNode = (
    <PropertySignKitModalBody
      previewMode={previewMode}
      onPreviewModeChange={onPreviewModeChange}
      showPriceOnExport={showPriceOnExport}
      onShowPriceOnExportChange={onShowPriceOnExportChange}
      previewOptions={previewOptions}
      qrLoading={qrLoading}
      qrSvg={qrSvg}
      trackedShareLink={trackedShareLink}
      trackedCopied={trackedCopied}
      onCopyTracked={onCopyTracked}
      onPrimaryDownload={onPrimaryDownload}
      onDownloadSign={onDownloadSign}
      onDownloadFlyer={onDownloadFlyer}
      onDownloadQr={onDownloadQr}
      primaryDownloadLabel={primaryDownloadLabel}
      assetBusy={assetBusy}
      previewTitle={previewTitle}
      headline={headline}
      title={title}
      locationLabel={locationLabel}
      priceLabel={priceLabel}
      error={error}
    />
  );

  return (
    <>
      {open ? (
        <div className="fixed inset-0 z-[95] hidden items-center justify-center bg-slate-950/50 p-6 md:flex" role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={descriptionId} data-testid="property-sign-kit-modal">
          <button
            type="button"
            aria-label="Close QR sign kit"
            className="absolute inset-0"
            onClick={() => onOpenChange(false)}
          />
          <div
            ref={panelRef}
            tabIndex={-1}
            className="relative z-[1] flex max-h-[min(90vh,980px)] w-full max-w-7xl flex-col overflow-hidden rounded-[36px] border border-white/20 bg-[linear-gradient(180deg,#f8fbff_0%,#eef5ff_100%)] shadow-[0_32px_120px_rgba(15,23,42,0.32)] outline-none"
          >
            <div className="border-b border-slate-200/80 bg-white/75 px-6 py-5 backdrop-blur sm:px-8">
              <div className="flex items-start justify-between gap-4">
                <div className="max-w-3xl">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-700">Listing marketing infrastructure</p>
                  <h2 id={titleId} className="mt-2 text-2xl font-semibold text-slate-950">QR sign kit</h2>
                  <p id={descriptionId} className="mt-2 text-sm text-slate-600 sm:text-base">
                    Review the tracked listing asset, choose a format, and export the version you need for offline sharing.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onOpenChange(false)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-slate-300 hover:text-slate-900"
                  aria-label="Close"
                >
                  ×
                </button>
              </div>
            </div>
            <div className="min-h-0 overflow-y-auto px-6 py-6 sm:px-8 sm:py-8">{content}</div>
          </div>
        </div>
      ) : null}

      <BottomSheet
        open={open}
        onOpenChange={onOpenChange}
        title="QR sign kit"
        description="Choose a format, review the tracked listing asset, and export the version you need."
        testId="property-sign-kit-sheet"
        className="max-h-[calc(100svh-0.5rem)]"
      >
        {content}
      </BottomSheet>
    </>
  );
}
