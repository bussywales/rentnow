"use client";

import { useState } from "react";
import Image from "next/image";
import type { PropertyImage } from "@/lib/types";

type Props = {
  images: PropertyImage[];
  title: string;
};

const fallbackImage =
  "https://images.unsplash.com/photo-1505691938895-1758d7feb511?auto=format&fit=crop&w=1400&q=80";
const blurDataURL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=";

export function PropertyGallery({ images, title }: Props) {
  const [current, setCurrent] = useState(0);
  const [broken, setBroken] = useState<Set<string>>(new Set());
  const safeImages = images.length ? images : [];
  const currentImage = safeImages[current] || safeImages[0];

  const imageKey = (img: PropertyImage, idx: number) => img.id || `${img.image_url}-${idx}`;
  const resolveSrc = (img: PropertyImage, idx: number) =>
    broken.has(imageKey(img, idx)) ? fallbackImage : img.image_url;
  const markBroken = (img: PropertyImage, idx: number) => {
    const key = imageKey(img, idx);
    setBroken((prev) => {
      if (prev.has(key)) return prev;
      const next = new Set(prev);
      next.add(key);
      return next;
    });
  };

  const handleKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowLeft") {
      setCurrent((prev) => (prev - 1 + safeImages.length) % safeImages.length);
    }
    if (e.key === "ArrowRight") {
      setCurrent((prev) => (prev + 1) % safeImages.length);
    }
  };

  if (!safeImages.length) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 py-12 text-center text-sm text-slate-600">
        <p className="text-base font-semibold text-slate-900">No photos available</p>
        <p className="mt-1 text-sm text-slate-600">
          This listing doesn&apos;t have images yet. Check back soon.
        </p>
      </div>
    );
  }

  const showNav = safeImages.length > 1;

  return (
    <div className="space-y-3 min-w-0 max-w-full">
      <div
        className="relative h-72 w-full max-w-full overflow-hidden rounded-2xl bg-slate-100"
        tabIndex={0}
        onKeyDown={handleKey}
        aria-label="Property photos"
      >
        <Image
          key={imageKey(currentImage, current)}
          src={resolveSrc(currentImage, current)}
          alt={title}
          fill
          className="object-cover"
          sizes="(max-width: 768px) 100vw, 640px"
          priority
          placeholder="blur"
          blurDataURL={blurDataURL}
          onError={() => markBroken(currentImage, current)}
        />
        {showNav && (
          <>
            <div className="absolute right-3 top-3 rounded-full bg-slate-900/70 px-3 py-1 text-xs font-semibold text-white">
              {current + 1} / {safeImages.length}
            </div>
            <button
              type="button"
              onClick={() =>
                setCurrent((prev) => (prev - 1 + safeImages.length) % safeImages.length)
              }
              className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-white/90 px-3 py-1 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-white"
              aria-label="Previous photo"
            >
              Prev
            </button>
            <button
              type="button"
              onClick={() => setCurrent((prev) => (prev + 1) % safeImages.length)}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-white/90 px-3 py-1 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-white"
              aria-label="Next photo"
            >
              Next
            </button>
          </>
        )}
      </div>
      <div className="flex w-full max-w-full min-w-0 gap-2 overflow-x-auto pb-1">
        {safeImages.map((img, idx) => (
          <button
            key={img.id || idx}
            type="button"
            onClick={() => setCurrent(idx)}
            className={`relative h-16 w-24 flex-none overflow-hidden rounded-lg border ${
              idx === current ? "border-sky-500 ring-2 ring-sky-200" : "border-slate-200"
            }`}
            aria-label={`Photo ${idx + 1}`}
          >
            <Image
              src={resolveSrc(img, idx)}
              alt={`${title} thumbnail ${idx + 1}`}
              fill
              className="object-cover"
              sizes="96px"
              placeholder="blur"
              blurDataURL={blurDataURL}
              onError={() => markBroken(img, idx)}
            />
          </button>
        ))}
      </div>
    </div>
  );
}
