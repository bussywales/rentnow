"use client";

import { useEffect, useRef } from "react";

export default function ReferralCaptureBootstrap() {
  const firedRef = useRef(false);

  useEffect(() => {
    if (firedRef.current) return;
    firedRef.current = true;

    void fetch("/api/referrals/capture", {
      method: "POST",
      credentials: "include",
    }).catch(() => undefined);
  }, []);

  return null;
}
