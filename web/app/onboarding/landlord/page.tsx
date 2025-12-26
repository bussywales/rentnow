"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

export const dynamic = "force-dynamic";

export default function LandlordOnboardingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    business_name: "",
    phone: "",
    preferred_contact: "Email",
    areas_served: "",
  });

  const handleChange = (key: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setLoading(true);
    setError(null);
    try {
      const supabase = createBrowserSupabaseClient();
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();
      if (authError || !user) {
        setError("Please log in to continue.");
        setLoading(false);
        return;
      }

      const areas = form.areas_served
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);

      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          business_name: form.business_name || null,
          phone: form.phone || null,
          preferred_contact: form.preferred_contact || null,
          areas_served: areas.length ? areas : null,
        })
        .eq("id", user.id);

      if (updateError) {
        setError(updateError.message);
      } else {
        router.replace("/dashboard/properties/new");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save onboarding details.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
          Landlord setup
        </p>
        <h1 className="text-2xl font-semibold text-slate-900">
          Tell us about your business
        </h1>
        <p className="text-sm text-slate-600">
          This helps tenants and the approval team reach you faster.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700">
            Business name (optional)
          </label>
          <Input
            value={form.business_name}
            onChange={(e) => handleChange("business_name", e.target.value)}
            placeholder="e.g. Peak Rentals Ltd"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700">
            Phone number
          </label>
          <Input
            value={form.phone}
            onChange={(e) => handleChange("phone", e.target.value)}
            placeholder="+234..."
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700">
            Preferred contact
          </label>
          <Select
            value={form.preferred_contact}
            onChange={(e) => handleChange("preferred_contact", e.target.value)}
          >
            <option value="Email">Email</option>
            <option value="Phone">Phone</option>
            <option value="WhatsApp">WhatsApp</option>
          </Select>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700">
            Areas served (optional)
          </label>
          <Input
            value={form.areas_served}
            onChange={(e) => handleChange("areas_served", e.target.value)}
            placeholder="Lekki, Ikoyi, VI"
          />
        </div>
      </div>

      {error && <p className="text-sm text-rose-600">{error}</p>}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="ghost" onClick={() => router.replace("/dashboard")}>
          Skip for now
        </Button>
        <Button onClick={handleSave} disabled={loading}>
          {loading ? "Saving..." : "Create your first listing"}
        </Button>
      </div>
    </div>
  );
}
