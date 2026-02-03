"use client";

import { useEffect } from "react";

export function SessionBootstrap() {
  useEffect(() => {
    fetch("/api/analytics/session", { credentials: "include" }).catch(() => null);
  }, []);

  return null;
}
