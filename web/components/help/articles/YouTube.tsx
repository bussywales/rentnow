"use client";

import Image from "next/image";
import { useMemo, useState } from "react";

type Props = {
  id: string;
  title?: string;
};

function sanitizeYoutubeId(id: string): string {
  return id.replace(/[^a-zA-Z0-9_-]/g, "");
}

export function YouTube({ id, title = "YouTube video" }: Props) {
  const safeId = sanitizeYoutubeId(id);
  const [isPlaying, setIsPlaying] = useState(false);
  const embedSrc = useMemo(
    () => `https://www.youtube.com/embed/${safeId}?autoplay=1&rel=0`,
    [safeId]
  );
  const thumbnailSrc = useMemo(() => `https://i.ytimg.com/vi/${safeId}/hqdefault.jpg`, [safeId]);
  if (!safeId) return null;

  return (
    <div className="space-y-2" data-testid="help-youtube-embed">
      <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-black pb-[56.25%]">
        {isPlaying ? (
          <iframe
            title={title}
            src={embedSrc}
            className="absolute inset-0 h-full w-full"
            loading="lazy"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        ) : (
          <button
            type="button"
            className="group absolute inset-0 h-full w-full cursor-pointer text-left"
            aria-label={`Watch walkthrough: ${title}`}
            data-testid="help-youtube-preview"
            onClick={() => setIsPlaying(true)}
          >
            <Image
              src={thumbnailSrc}
              alt=""
              fill
              unoptimized
              sizes="(max-width: 768px) 100vw, 720px"
              className="absolute inset-0 h-full w-full object-cover opacity-80 transition duration-200 group-hover:opacity-90"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/20 to-slate-950/40" />
            <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-4 text-white">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/70">
                  Watch walkthrough
                </p>
                <p className="mt-1 line-clamp-2 text-sm font-semibold leading-5 text-white">{title}</p>
              </div>
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/12 backdrop-blur-sm transition group-hover:scale-105 group-focus-visible:scale-105">
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="ml-1 h-6 w-6 text-white"
                >
                  <path d="M8 6.82v10.36c0 .79.87 1.27 1.54.84l8.15-5.18a1 1 0 0 0 0-1.68L9.54 5.98A1 1 0 0 0 8 6.82Z" />
                </svg>
              </span>
            </div>
          </button>
        )}
      </div>
      <p className="text-xs text-slate-500">{title}</p>
    </div>
  );
}
