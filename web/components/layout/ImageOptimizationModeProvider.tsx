"use client";

import { createContext, useContext } from "react";
import type { ImageOptimizationMode } from "@/lib/media/image-optimization-mode";

const ImageOptimizationModeContext = createContext<ImageOptimizationMode>("vercel_default");

export function ImageOptimizationModeProvider({
  mode,
  children,
}: {
  mode: ImageOptimizationMode;
  children: React.ReactNode;
}) {
  return (
    <ImageOptimizationModeContext.Provider value={mode}>
      {children}
    </ImageOptimizationModeContext.Provider>
  );
}

export function useImageOptimizationMode() {
  return useContext(ImageOptimizationModeContext);
}
