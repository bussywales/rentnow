"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { ErrorState } from "@/components/ui/ErrorState";

type Props = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function GlobalError({ error, reset }: Props) {
  useEffect(() => {
    console.error("Unhandled app error", error);
  }, [error]);

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
