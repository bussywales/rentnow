"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { captureClientBoundaryException } from "@/lib/monitoring/sentry";
import { Button } from "@/components/ui/Button";
import { ErrorState } from "@/components/ui/ErrorState";

type Props = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function GlobalError({ error, reset }: Props) {
  const pathname = usePathname();

  useEffect(() => {
    captureClientBoundaryException(error, {
      route: pathname || "/_error",
      digest: error.digest || null,
      pathname: pathname || null,
      href: typeof window !== "undefined" ? window.location.href : null,
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : null,
      extra: {
        source: "app_error_boundary",
      },
      fingerprint: error.digest ? ["next-app-error", error.digest] : undefined,
    });

    const payload = JSON.stringify({
      digest: error.digest,
      message: error.message || "Unhandled app error",
      stack: error.stack,
      pathname: pathname || undefined,
      href: typeof window !== "undefined" ? window.location.href : undefined,
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
    });

    const url = "/api/client-errors";
    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      const blob = new Blob([payload], { type: "application/json" });
      navigator.sendBeacon(url, blob);
    } else {
      void fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
        keepalive: true,
      }).catch(() => undefined);
    }

    console.error("Unhandled app error", error);
  }, [error, pathname]);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-10">
      <ErrorState
        title="Something went wrong"
        description="An unexpected error occurred. Please retry or come back in a moment."
        retryAction={
          <Button size="sm" variant="secondary" onClick={() => reset()}>
            Retry
          </Button>
        }
        requestId={error.digest}
      />
    </div>
  );
}
