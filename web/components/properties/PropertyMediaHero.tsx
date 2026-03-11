"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PropertyImage } from "@/lib/types";
import { shouldRenderDemoWatermark } from "@/lib/properties/demo";
import { resolveListingHeroMediaPreference } from "@/lib/properties/listing-quality";
import { PropertyGallery } from "@/components/properties/PropertyGallery";

type PropertyMediaHeroProps = {
  propertyId: string;
  title: string;
  images: PropertyImage[];
  isDemo?: boolean;
  hasVideo?: boolean;
  featuredMedia?: "image" | "video" | null;
  coverImageUrl?: string | null;
};

type MediaMode = "idle" | "loading" | "ready" | "fallback";

const HERO_FALLBACK_IMAGE = "/og-propatyhub.png";

type PropertyVideoPresentationInput = {
  featuredMedia?: "image" | "video" | null;
  hasVideo?: boolean;
};

type PropertyVideoPresentation = {
  prefersVideoHero: boolean;
  showVideoTourChip: boolean;
  showInlineVideoSection: boolean;
};

export function resolvePropertyVideoPresentation(
  input: PropertyVideoPresentationInput
): PropertyVideoPresentation {
  const heroPreference = resolveListingHeroMediaPreference({
    featured_media: input.featuredMedia ?? null,
    has_video: input.hasVideo ?? null,
  });
  const prefersVideoHero = heroPreference.mode === "video";
  const hasVideoSignal = heroPreference.hasVideo;
  return {
    prefersVideoHero,
    showVideoTourChip: hasVideoSignal,
    showInlineVideoSection: hasVideoSignal && !prefersVideoHero,
  };
}

export function PropertyMediaHero({
  propertyId,
  title,
  images,
  isDemo = false,
  hasVideo = false,
  featuredMedia = "image",
  coverImageUrl = null,
}: PropertyMediaHeroProps) {
  const heroMediaPreference = useMemo(
    () =>
      resolveListingHeroMediaPreference({
        featured_media: featuredMedia,
        has_video: hasVideo,
        cover_image_url: coverImageUrl,
        images,
      }),
    [coverImageUrl, featuredMedia, hasVideo, images]
  );
  const presentation = useMemo(
    () =>
      resolvePropertyVideoPresentation({
        featuredMedia,
        hasVideo: heroMediaPreference.hasVideo,
      }),
    [featuredMedia, heroMediaPreference.hasVideo]
  );
  const [mediaMode, setMediaMode] = useState<MediaMode>(() =>
    presentation.prefersVideoHero
      ? "loading"
      : presentation.showInlineVideoSection
        ? "idle"
        : "fallback"
  );
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [videoFetchRequested, setVideoFetchRequested] = useState(
    presentation.prefersVideoHero
  );
  const autoPlayOnReadyRef = useRef(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const videoTourSectionRef = useRef<HTMLDivElement | null>(null);
  const showDemoWatermark = shouldRenderDemoWatermark({ isDemo, enabled: true });
  const posterUrl = useMemo(
    () => heroMediaPreference.imageUrl ?? images[0]?.image_url ?? HERO_FALLBACK_IMAGE,
    [heroMediaPreference.imageUrl, images]
  );

  const shouldFetchVideo =
    presentation.showVideoTourChip && videoFetchRequested && !videoUrl;

  useEffect(() => {
    if (!shouldFetchVideo) return;
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
          setVideoFetchRequested(false);
          setMediaMode("fallback");
          return;
        }
        setVideoUrl(payload.url);
        setVideoFetchRequested(false);
        setMediaMode("ready");
        if (autoPlayOnReadyRef.current) {
          autoPlayOnReadyRef.current = false;
          setTimeout(() => {
            const element = videoRef.current;
            if (!element) return;
            void element.play().catch(() => {
              setPlaybackError("Unable to start playback right now.");
            });
          }, 0);
        }
      } catch {
        if (!active) return;
        autoPlayOnReadyRef.current = false;
        setVideoFetchRequested(false);
        setMediaMode("fallback");
      }
    })();

    return () => {
      active = false;
      controller.abort();
    };
  }, [propertyId, shouldFetchVideo]);

  const startPlayback = useCallback(() => {
    autoPlayOnReadyRef.current = false;
    const element = videoRef.current;
    if (!element) return;
    setPlaybackError(null);
    setIsPlaying(true);
    void element.play().catch(() => {
      setPlaybackError("Unable to start playback right now.");
    });
  }, []);

  const handlePlay = useCallback(() => {
    if (!videoUrl) {
      setPlaybackError(null);
      setMediaMode("loading");
      setVideoFetchRequested(true);
      autoPlayOnReadyRef.current = true;
      return;
    }
    startPlayback();
  }, [startPlayback, videoUrl]);

  const handleOpenVideoTour = useCallback(() => {
    videoTourSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    if (!presentation.prefersVideoHero || !videoUrl) return;
    setPlaybackError(null);
    startPlayback();
  }, [presentation.prefersVideoHero, startPlayback, videoUrl]);

  if (!presentation.showVideoTourChip) {
    return <PropertyGallery images={images} title={title} isDemo={isDemo} />;
  }

  if (presentation.prefersVideoHero && mediaMode === "fallback") {
    return <PropertyGallery images={images} title={title} isDemo={isDemo} />;
  }

  const showVideoTourChip =
    presentation.showVideoTourChip &&
    (presentation.showInlineVideoSection || mediaMode !== "fallback");

  return (
    <div className="space-y-3 min-w-0 max-w-full">
      {presentation.prefersVideoHero ? (
        <div
          id="property-video-tour"
          ref={videoTourSectionRef}
          className="relative h-72 w-full max-w-full overflow-hidden rounded-2xl bg-slate-950"
          data-testid="property-video-hero"
        >
          <video
            ref={videoRef}
            src={videoUrl ?? undefined}
            poster={posterUrl}
            preload={videoUrl ? "metadata" : "none"}
            playsInline
            controls={Boolean(videoUrl) && isPlaying}
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
      ) : null}
      <div className="flex items-center justify-between gap-3 px-1">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
          Photo gallery
        </p>
        {showVideoTourChip ? (
          <button
            type="button"
            onClick={handleOpenVideoTour}
            className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-700 shadow-sm transition hover:bg-slate-50"
            data-testid="property-video-tour-chip"
            aria-label="Open video tour"
          >
            <span aria-hidden>▶</span>
            <span>Video tour</span>
          </button>
        ) : null}
      </div>
      <PropertyGallery images={images} title={title} isDemo={isDemo} />
      {presentation.showInlineVideoSection ? (
        <div
          id="property-video-tour"
          ref={videoTourSectionRef}
          className="relative h-72 w-full max-w-full overflow-hidden rounded-2xl bg-slate-950"
          data-testid="property-video-tour-section"
        >
          <video
            ref={videoRef}
            src={videoUrl ?? undefined}
            poster={posterUrl}
            preload={videoUrl ? "metadata" : "none"}
            playsInline
            controls={Boolean(videoUrl) && isPlaying}
            className="h-full w-full object-cover"
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onError={() => setPlaybackError("Unable to play this video right now.")}
          />
          {!isPlaying ? (
            <button
              type="button"
              className="absolute inset-0 z-10 flex items-center justify-center bg-slate-900/20"
              onClick={handlePlay}
              data-testid="property-video-tour-play"
              aria-label="Play video tour"
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
          {mediaMode === "fallback" ? (
            <span className="pointer-events-none absolute left-3 top-3 rounded-full bg-slate-900/75 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-white">
              Video unavailable
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
      ) : null}
    </div>
  );
}
