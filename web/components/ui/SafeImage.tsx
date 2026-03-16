"use client";

import { useMemo, useState, type ReactNode } from "react";
import Image, { type ImageLoader, type ImageProps } from "next/image";
import { cn } from "@/components/ui/cn";
import { shouldBypassNextImageOptimizer } from "@/lib/media/safe-image";
import { useImageOptimizationMode } from "@/components/layout/ImageOptimizationModeProvider";
import {
  shouldDisableImageOptimizationForUsage,
  type ImageOptimizationUsage,
} from "@/lib/media/image-optimization-mode";

const directImageLoader: ImageLoader = ({ src }) => src;

export type SafeImageProps = Omit<ImageProps, "src" | "alt"> & {
  src: string;
  alt: string;
  wrapperClassName?: string;
  fallbackLabel?: string;
  fallbackContent?: ReactNode;
  usage?: ImageOptimizationUsage;
};

export function SafeImage({
  src,
  alt,
  className,
  wrapperClassName,
  fallbackLabel = "Image unavailable",
  fallbackContent,
  usage = "noncritical",
  onLoad,
  onError,
  fill,
  ...imageProps
}: SafeImageProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const optimizationMode = useImageOptimizationMode();
  const bypassOptimizer = useMemo(() => shouldBypassNextImageOptimizer(src), [src]);
  const unoptimized = useMemo(
    () =>
      shouldDisableImageOptimizationForUsage({
        mode: optimizationMode,
        usage,
        bypassOptimizer,
      }),
    [bypassOptimizer, optimizationMode, usage]
  );

  return (
    <div
      className={cn(
        "relative overflow-hidden",
        fill ? "h-full w-full" : "inline-block",
        wrapperClassName
      )}
      data-safe-image-root="true"
    >
      <div
        className={cn(
          "pointer-events-none absolute inset-0 bg-gradient-to-br from-slate-200 via-slate-100 to-slate-200 transition-opacity duration-300",
          isLoaded || hasError ? "opacity-0" : "opacity-100"
        )}
        aria-hidden="true"
      />

      {!hasError ? (
        <Image
          {...imageProps}
          fill={fill}
          src={src}
          alt={alt}
          className={className}
          unoptimized={unoptimized}
          loader={unoptimized ? directImageLoader : undefined}
          onLoad={(event) => {
            setIsLoaded(true);
            onLoad?.(event);
          }}
          onError={(event) => {
            setHasError(true);
            onError?.(event);
          }}
        />
      ) : (
        <div className="absolute inset-0 bg-slate-100" aria-hidden="true" />
      )}

      {hasError ? (
        <div className="pointer-events-none absolute inset-0 flex items-end justify-start p-2">
          {fallbackContent ?? (
            <span className="rounded-full border border-slate-300/90 bg-white/90 px-2 py-0.5 text-[10px] font-medium text-slate-700 shadow-sm">
              {fallbackLabel}
            </span>
          )}
        </div>
      ) : null}
    </div>
  );
}
