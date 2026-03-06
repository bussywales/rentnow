"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PropertyImage } from "@/lib/types";
import { shouldRenderDemoWatermark } from "@/lib/properties/demo";
import { PropertyGallery } from "@/components/properties/PropertyGallery";

type PropertyMediaHeroProps = {
  propertyId: string;
  title: string;
  images: PropertyImage[];
  isDemo?: boolean;
  featuredMedia?: "image" | "video" | null;
  coverImageUrl?: string | null;
};

type MediaMode = "loading" | "ready" | "fallback";

const HERO_FALLBACK_IMAGE = "/og-propatyhub.png";

export function PropertyMediaHero({
  propertyId,
  title,
  images,
  isDemo = false,
  featuredMedia = "image",
  coverImageUrl = null,
}: PropertyMediaHeroProps) {
  const prefersVideo = featuredMedia === "video";
  const [mediaMode, setMediaMode] = useState<MediaMode>(
    prefersVideo ? "loading" : "fallback"
  );
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const showDemoWatermark = shouldRenderDemoWatermark({ isDemo, enabled: true });
  const posterUrl = useMemo(
    () => coverImageUrl ?? images[0]?.image_url ?? HERO_FALLBACK_IMAGE,
    [coverImageUrl, images]
  );

  useEffect(() => {
    if (!prefersVideo) return;

    let active = true;
    const controller = new AbortController();

    void (async () => {
      try {
        const response = await fetch(`/api/properties/${propertyId}/video/public`, {
          method: "GET",
          signal: controller.signal,
          credentials: "same-origin",
        });
        const payload = (await response.json().catch(() => null)) as
          | { url?: string; error?: string }
          | null;
        if (!active) return;
        if (!response.ok || !payload?.url) {
          setMediaMode("fallback");
          return;
        }
        setVideoUrl(payload.url);
        setMediaMode("ready");
      } catch {
        if (!active) return;
        setMediaMode("fallback");
      }
    })();

    return () => {
      active = false;
      controller.abort();
    };
  }, [prefersVideo, propertyId]);

  const handlePlay = useCallback(() => {
    setIsPlaying(true);
    setPlaybackError(null);
    const element = videoRef.current;
    if (!element) return;
    void element.play().catch(() => {
      setPlaybackError("Unable to start playback right now.");
    });
  }, []);

  if (!prefersVideo || mediaMode === "fallback") {
    return <PropertyGallery images={images} title={title} isDemo={isDemo} />;
  }

  return (
    <div className="space-y-3 min-w-0 max-w-full">
      <div
        className="relative h-72 w-full max-w-full overflow-hidden rounded-2xl bg-slate-950"
        data-testid="property-video-hero"
      >
        <video
          ref={videoRef}
          src={videoUrl ?? undefined}
          poster={posterUrl}
          preload={videoUrl ? "metadata" : "none"}
          playsInline
          controls={isPlaying}
          className="h-full w-full object-cover"
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onError={() => setPlaybackError("Unable to play this video right now.")}
        />

        {!isPlaying && mediaMode === "ready" && videoUrl ? (
          <button
            type="button"
            className="absolute inset-0 z-10 flex items-center justify-center bg-slate-900/20"
            onClick={handlePlay}
            data-testid="property-video-hero-play"
            aria-label="Play listing video"
          >
            <span className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-white/90 text-xl text-slate-900 shadow-lg">
              ▶
            </span>
          </button>
        ) : null}

        {mediaMode === "loading" ? (
          <span className="pointer-events-none absolute left-3 top-3 rounded-full bg-slate-900/75 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-white">
            Loading video
          </span>
        ) : null}

        {playbackError ? (
          <span className="pointer-events-none absolute left-3 bottom-3 rounded-full bg-slate-900/80 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-white">
            {playbackError}
          </span>
        ) : null}

        {showDemoWatermark ? (
          <div
            className="property-demo-watermark pointer-events-none absolute inset-0 z-[2] flex items-center justify-center text-5xl font-black uppercase tracking-[0.5em] text-white/25"
            aria-hidden
          >
            Demo
          </div>
        ) : null}
      </div>
      {images.length > 0 ? (
        <PropertyGallery images={images} title={title} isDemo={isDemo} />
      ) : null}
    </div>
  );
}
