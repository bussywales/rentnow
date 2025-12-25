import type { ReactNode } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";

type Props = {
  title: string;
  description?: string;
  retryHref?: string;
  retryLabel?: string;
  retryAction?: ReactNode;
  requestId?: string;
  diagnostics?: Record<string, unknown>;
};

export function ErrorState({
  title,
  description,
  retryHref,
  retryLabel = "Retry",
  retryAction,
  requestId,
  diagnostics,
}: Props) {
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 text-amber-900">
      <h1 className="text-xl font-semibold">{title}</h1>
      {description && <p className="mt-2 text-sm text-amber-800">{description}</p>}
      {(retryAction || retryHref) && (
        <div className="mt-3 flex flex-wrap gap-2">
          {retryAction}
          {!retryAction && retryHref && (
            <Link href={retryHref}>
              <Button size="sm" variant="secondary">
                {retryLabel}
              </Button>
            </Link>
          )}
        </div>
      )}
      {requestId && (
        <p className="mt-2 text-xs text-amber-800">Request ID: {requestId}</p>
      )}
      {diagnostics && (
        <div className="mt-3 rounded-lg bg-amber-100/70 p-3 text-xs text-amber-900">
          <p className="font-semibold">Diagnostics</p>
          <pre className="mt-2 whitespace-pre-wrap font-mono">
            {JSON.stringify(diagnostics, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
