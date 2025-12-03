"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

const roles = [
  { value: "tenant", label: "Tenant", description: "Search, save, and request viewings." },
  { value: "landlord", label: "Landlord", description: "List properties and manage leads." },
  { value: "agent", label: "Agent", description: "Manage multiple listings and enquiries." },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [selected, setSelected] = useState("tenant");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getClient = () => {
    try {
      return createBrowserSupabaseClient();
    } catch {
      setError("Supabase environment variables are missing.");
      return null;
    }
  };

  const handleSave = async () => {
    setLoading(true);
    setError(null);
    const supabase = getClient();
    if (!supabase) {
      setLoading(false);
      return;
    }
    const {
      data: { user },
      error: sessionError,
    } = await supabase.auth.getUser();
    if (sessionError || !user) {
      setError("Please log in first.");
      setLoading(false);
      return;
    }

    const { error: profileError } = await supabase
      .from("profiles")
      .upsert({ id: user.id, role: selected });

    if (profileError) {
      setError(profileError.message);
    } else {
      router.replace(selected === "tenant" ? "/properties" : "/dashboard");
    }
    setLoading(false);
  };

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Onboarding</p>
        <h1 className="text-2xl font-semibold text-slate-900">Choose your role</h1>
        <p className="text-sm text-slate-600">You can change this later in your profile.</p>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {roles.map((role) => (
          <button
            key={role.value}
            type="button"
            onClick={() => setSelected(role.value)}
            className={`rounded-xl border p-4 text-left shadow-sm transition ${
              selected === role.value
                ? "border-sky-400 bg-sky-50"
                : "border-slate-200 bg-white hover:border-sky-200"
            }`}
          >
            <p className="text-lg font-semibold text-slate-900">{role.label}</p>
            <p className="text-sm text-slate-600">{role.description}</p>
          </button>
        ))}
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={loading}>
          {loading ? "Saving..." : "Continue"}
        </Button>
      </div>
    </div>
  );
}
