"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";

type ProviderCandidate = {
  id: string;
  businessName: string;
  coverageSummary: string;
};

type Props = {
  requestId: string;
  providers: ProviderCandidate[];
};

export function AdminMoveReadyDispatchForm({ requestId, providers }: Props) {
  const router = useRouter();
  const [selectedProviderId, setSelectedProviderId] = useState(providers[0]?.id ?? "");
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedProviderId) return;
    setSubmitting(true);
    setMessage(null);

    const response = await fetch(`/api/admin/services/requests/${requestId}/dispatch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ providerId: selectedProviderId }),
    }).catch(() => null);

    setSubmitting(false);

    if (!response || !response.ok) {
      setMessage("Lead dispatch failed.");
      return;
    }

    setMessage("Lead dispatched. Operator progress has been updated.");
    router.refresh();
  }

  if (providers.length === 0) {
    return (
      <Alert
        variant="warning"
        title="No eligible providers"
        description="This request is still unmatched. Add or approve a provider with the right area and category before routing manually."
      />
    );
  }

  return (
    <form className="space-y-3" onSubmit={handleSubmit}>
      {message ? <Alert variant="info" title="Routing update" description={message} /> : null}
      <label className="block space-y-1 text-sm font-medium text-slate-700">
        Route to provider
        <select
          value={selectedProviderId}
          onChange={(event) => setSelectedProviderId(event.target.value)}
          className="w-full rounded-xl border border-slate-200 px-3 py-2"
        >
          {providers.map((provider) => (
            <option key={provider.id} value={provider.id}>
              {provider.businessName} — {provider.coverageSummary}
            </option>
          ))}
        </select>
      </label>
      <Button type="submit" disabled={submitting}>
        {submitting ? "Routing..." : "Dispatch provider"}
      </Button>
    </form>
  );
}
