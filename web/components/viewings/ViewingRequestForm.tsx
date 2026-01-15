"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";

type Props = {
  propertyId: string;
};

export function ViewingRequestForm({ propertyId }: Props) {
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">(
    "idle"
  );
  const [error, setError] = useState<string | null>(null);
  const supabaseEnabled =
    !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
    !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setStatus("loading");
    setError(null);

    if (!supabaseEnabled) {
      setError("Viewing requests require Supabase. Try the demo listings instead.");
      setStatus("error");
      return;
    }

    if (propertyId.startsWith("mock")) {
      setError("Viewing requests require a real property ID and Supabase auth.");
      setStatus("error");
      return;
    }

    const form = new FormData(e.currentTarget);
    const dateValue = form.get("preferred_date") as string | null;
    const timeWindow = form.get("preferred_time_window") as string | null;
    const note = form.get("note") as string | null;
    const preferredTimes = dateValue ? [`${dateValue}T12:00:00`] : [];
    const message = [note, timeWindow ? `Preferred window: ${timeWindow}` : null]
      .filter(Boolean)
      .join(" ")
      .trim();

    const res = await fetch("/api/viewings/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        propertyId,
        preferredTimes,
        message: message || undefined,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      setError(text || "Unable to request viewing.");
      setStatus("error");
      return;
    }

    setStatus("success");
  };

  return (
    <form className="mt-3 space-y-3" onSubmit={handleSubmit}>
      <Input type="date" name="preferred_date" required />
      <Input name="preferred_time_window" placeholder="Preferred time window" />
      <Textarea
        name="note"
        rows={3}
        placeholder="Anything the host should know?"
      />
      <Button className="w-full" type="submit" disabled={status === "loading"}>
        {status === "loading" ? "Sending..." : "Request viewing"}
      </Button>
      {status === "success" && (
        <p className="text-sm text-green-700">
          Request sent. The host will get back to you.
        </p>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </form>
  );
}
