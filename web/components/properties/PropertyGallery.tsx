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

export function PropertyGallery({ images, title }: Props) {
  const [current, setCurrent] = useState(0);
  const safeImages = images.length ? images : [{ id: "fallback", image_url: fallbackImage }];
  const currentImage = safeImages[current] || safeImages[0];

  const handleKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowLeft") {
      setCurrent((prev) => (prev - 1 + safeImages.length) % safeImages.length);
    }
    if (e.key === "ArrowRight") {
      setCurrent((prev) => (prev + 1) % safeImages.length);
    }
  };

  return (
    <div className="space-y-3">
      <div
        className="relative h-72 overflow-hidden rounded-2xl bg-slate-100"
        tabIndex={0}
        onKeyDown={handleKey}
        aria-label="Property photos"
      >
        <Image
          src={currentImage.image_url}
          alt={title}
          fill
          className="object-cover"
          sizes="(max-width: 768px) 100vw, 640px"
          priority
        />
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1">
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
              src={img.image_url}
              alt={`${title} thumbnail ${idx + 1}`}
              fill
              className="object-cover"
              sizes="96px"
            />
          </button>
        ))}
      </div>
    </div>
  );
}
