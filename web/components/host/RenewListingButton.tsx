"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

type Props = {
  propertyId: string;
  size?: "sm" | "md" | "lg";
  variant?: "primary" | "secondary";
  className?: string;
};

export function RenewListingButton({
  propertyId,
  size = "sm",
  variant = "primary",
  className,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const renew = () => {
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/properties/${propertyId}/renew`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error || "Could not renew listing");
        return;
      }
      router.refresh();
    });
  };

  return (
    <div className={className}>
      <Button size={size} variant={variant} onClick={renew} disabled={pending}>
        {pending ? "Renewing..." : "Renew listing"}
      </Button>
      {error && <p className="mt-1 text-xs text-rose-600">{error}</p>}
    </div>
  );
}
