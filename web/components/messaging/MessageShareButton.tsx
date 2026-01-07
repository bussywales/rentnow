"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

type Props = {
  propertyId: string;
  tenantId: string;
};

type ShareResponse = {
  link: string;
  expires_at: string;
};

export function MessageShareButton({ propertyId, tenantId }: Props) {
  const [open, setOpen] = useState(false);
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const buildLink = async (rotate: boolean) => {
    setLoading(true);
    setError(null);
    setCopied(false);
    try {
      const res = await fetch("/api/messages/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          property_id: propertyId,
          tenant_id: tenantId,
          rotate,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error || "Unable to create a share link.");
        return;
      }
      const data = (await res.json()) as ShareResponse;
      setShareLink(data.link);
      setExpiresAt(data.expires_at);
    } catch (err) {
      console.warn("Failed to create share link", err);
      setError("Unable to create a share link.");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!shareLink) return;
    try {
      await navigator.clipboard.writeText(shareLink);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  const handleRevoke = async () => {
    setLoading(true);
    setError(null);
    setCopied(false);
    try {
      const res = await fetch("/api/messages/share/revoke", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          property_id: propertyId,
          tenant_id: tenantId,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error || "Unable to revoke share link.");
        return;
      }
      setShareLink(null);
      setExpiresAt(null);
    } catch (err) {
      console.warn("Failed to revoke share link", err);
      setError("Unable to revoke share link.");
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = () => {
    const next = !open;
    setOpen(next);
    if (next && !shareLink) {
      void buildLink(false);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-slate-900">Share thread</p>
          <p className="text-xs text-slate-600">Create a read-only link.</p>
        </div>
        <Button size="sm" variant="secondary" onClick={handleToggle}>
          {open ? "Hide" : "Share"}
        </Button>
      </div>
      {open && (
        <div className="mt-3 space-y-2">
          {shareLink ? (
            <div className="space-y-2">
              <Input readOnly value={shareLink} className="h-9" />
              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" type="button" onClick={handleCopy}>
                  {copied ? "Copied" : "Copy link"}
                </Button>
                <Button
                  size="sm"
                  type="button"
                  variant="secondary"
                  onClick={() => buildLink(true)}
                  disabled={loading}
                >
                  Rotate link
                </Button>
                <Button
                  size="sm"
                  type="button"
                  variant="secondary"
                  onClick={handleRevoke}
                  disabled={loading}
                >
                  Revoke
                </Button>
              </div>
              {expiresAt && (
                <p className="text-xs text-slate-500">
                  Expires {new Date(expiresAt).toLocaleString()}
                </p>
              )}
            </div>
          ) : (
            <Button size="sm" type="button" onClick={() => buildLink(false)} disabled={loading}>
              {loading ? "Generating..." : "Generate link"}
            </Button>
          )}
          {error && <p className="text-xs text-rose-600">{error}</p>}
        </div>
      )}
    </div>
  );
}
