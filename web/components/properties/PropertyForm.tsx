"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { Property, RentalType } from "@/lib/types";

type FormState = Partial<Property> & { amenitiesText?: string };

type Props = {
  initialData?: Partial<Property>;
  onSubmit?: (data: FormState) => Promise<void> | void;
};

const rentalTypes: { label: string; value: RentalType }[] = [
  { label: "Short-let", value: "short_let" },
  { label: "Long-term", value: "long_term" },
];

const STORAGE_BUCKET =
  process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET || "property-images";

export function PropertyForm({ initialData, onSubmit }: Props) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const [form, setForm] = useState<FormState>({
    rental_type: "long_term",
    currency: "USD",
    amenitiesText: initialData?.amenities?.join(", ") ?? "",
    ...initialData,
  });
  const [aiLoading, setAiLoading] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const getSupabase = () => {
    try {
      return createBrowserSupabaseClient();
    } catch {
      setError("Supabase environment variables are missing.");
      return null;
    }
  };

  const handleChange = (key: keyof FormState, value: string | number | boolean) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    const payload: FormState = {
      ...form,
      amenities: form.amenitiesText
        ? form.amenitiesText.split(",").map((a) => a.trim()).filter(Boolean)
        : [],
    };
    startTransition(async () => {
      if (onSubmit) {
        await onSubmit(payload);
        return;
      }

      try {
        const supabase = getSupabase();
        if (!supabase) return;
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) {
          setError("Please log in to save a listing.");
          return;
        }

        const uploadedUrls: string[] = [];
        if (files.length) {
          setUploading(true);
          setUploadProgress(0);
          if (!STORAGE_BUCKET) {
            throw new Error("Storage bucket is not configured.");
          }
          for (let i = 0; i < files.length; i += 1) {
            const file = files[i];
            if (file.size > 5 * 1024 * 1024) {
              throw new Error(`File ${file.name} exceeds 5MB limit.`);
            }
            if (!file.type.startsWith("image/")) {
              throw new Error(`File ${file.name} is not an image.`);
            }
            const path = `${user.id}/${Date.now()}-${file.name}`;
            const { error: uploadError } = await supabase.storage
              .from(STORAGE_BUCKET)
              .upload(path, file);
            if (uploadError) {
              throw new Error(uploadError.message);
            }
            const { data: publicUrl } = supabase.storage
              .from(STORAGE_BUCKET)
              .getPublicUrl(path);
            uploadedUrls.push(publicUrl.publicUrl);
            setUploadProgress(Math.round(((i + 1) / files.length) * 100));
          }
          setUploading(false);
        }

        const res = await fetch(initialData?.id ? `/api/properties/${initialData.id}` : "/api/properties", {
          method: initialData?.id ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...payload,
            imageUrls: uploadedUrls,
          }),
        });

        if (!res.ok) {
          const errText = await res.text();
          throw new Error(errText);
        }

        router.push("/dashboard");
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unable to save listing.";
        setError(message);
      } finally {
        setUploading(false);
      }
      });
  };

  const handleAiDescription = async () => {
    setAiLoading(true);
    try {
      const response = await fetch("/api/ai/generate-description", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title,
          city: form.city,
          neighbourhood: form.neighbourhood,
          rentalType: form.rental_type,
          price: form.price,
          currency: form.currency,
          bedrooms: form.bedrooms,
          bathrooms: form.bathrooms,
          furnished: form.furnished,
          amenities: form.amenitiesText
            ?.split(",")
            .map((a) => a.trim())
            .filter(Boolean),
          maxGuests: form.max_guests,
          nearbyLandmarks: [],
        }),
      });

      const data = await response.json();
      if (data?.description) {
        setForm((prev) => ({ ...prev, description: data.description }));
      }
    } catch (error) {
      console.error("Failed to generate description", error);
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <form className="space-y-6" onSubmit={handleSubmit}>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700">Title</label>
          <Input
            required
            value={form.title || ""}
            onChange={(e) => handleChange("title", e.target.value)}
            placeholder="e.g. Bright 2-bed in Lekki Phase 1"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700">Rental type</label>
          <Select
            value={form.rental_type}
            onChange={(e) => handleChange("rental_type", e.target.value as RentalType)}
          >
            {rentalTypes.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700">City</label>
          <Input
            required
            value={form.city || ""}
            onChange={(e) => handleChange("city", e.target.value)}
            placeholder="Lagos, Nairobi, Accra..."
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700">Neighbourhood</label>
          <Input
            value={form.neighbourhood || ""}
            onChange={(e) => handleChange("neighbourhood", e.target.value)}
            placeholder="Lekki Phase 1, Kilimani..."
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700">Address</label>
          <Input
            value={form.address || ""}
            onChange={(e) => handleChange("address", e.target.value)}
            placeholder="Street, building, house number"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Latitude</label>
            <Input
              type="number"
              step="0.000001"
              value={form.latitude ?? ""}
              onChange={(e) => handleChange("latitude", Number(e.target.value))}
              placeholder="6.5244"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Longitude</label>
            <Input
              type="number"
              step="0.000001"
              value={form.longitude ?? ""}
              onChange={(e) => handleChange("longitude", Number(e.target.value))}
              placeholder="3.3792"
            />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Bedrooms</label>
            <Input
              type="number"
              min={0}
              value={form.bedrooms ?? 0}
              onChange={(e) => handleChange("bedrooms", Number(e.target.value))}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Bathrooms</label>
            <Input
              type="number"
              min={0}
              value={form.bathrooms ?? 0}
              onChange={(e) => handleChange("bathrooms", Number(e.target.value))}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Max guests</label>
            <Input
              type="number"
              min={0}
              value={form.max_guests ?? ""}
              onChange={(e) => handleChange("max_guests", Number(e.target.value))}
              placeholder="For short-let"
            />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Price</label>
            <Input
              type="number"
              min={0}
              value={form.price ?? ""}
              onChange={(e) => handleChange("price", Number(e.target.value))}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Currency</label>
            <Input
              value={form.currency || "USD"}
              onChange={(e) => handleChange("currency", e.target.value)}
              placeholder="USD / NGN / KES / GHS"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Available from</label>
            <Input
              type="date"
              value={form.available_from || ""}
              onChange={(e) => handleChange("available_from", e.target.value)}
            />
          </div>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700">Amenities</label>
          <Input
            value={form.amenitiesText || ""}
            onChange={(e) => handleChange("amenitiesText", e.target.value)}
            placeholder="wifi, parking, security, pool"
          />
        </div>
        <div className="flex items-center gap-3">
          <input
            id="furnished"
            type="checkbox"
            className="h-4 w-4 rounded border-slate-300 text-sky-600"
            checked={!!form.furnished}
            onChange={(e) => handleChange("furnished", e.target.checked)}
          />
          <label htmlFor="furnished" className="text-sm text-slate-700">
            Furnished
          </label>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <label className="text-sm font-medium text-slate-700">
            Description
          </label>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={handleAiDescription}
            disabled={aiLoading}
          >
            {aiLoading ? "Generating..." : "Generate with AI"}
          </Button>
        </div>
        <Textarea
          rows={5}
          value={form.description || ""}
          onChange={(e) => handleChange("description", e.target.value)}
          placeholder="Share highlights, who it's great for, and availability."
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-700">
          Photos (Supabase Storage)
        </label>
        <input
          type="file"
          accept="image/*"
          multiple
          onChange={(e) => setFiles(Array.from(e.target.files || []))}
          className="w-full rounded-lg border border-dashed border-slate-300 bg-white px-4 py-3 text-sm text-slate-700"
        />
        {files.length > 0 && (
          <p className="text-xs text-slate-600">
            {files.length} file{files.length > 1 ? "s" : ""} selected.
          </p>
        )}
        {uploading && (
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full bg-sky-500 transition-all"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        )}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex items-center justify-end gap-3">
        <Button type="submit" disabled={pending}>
          {pending || uploading ? "Saving..." : "Save listing"}
        </Button>
      </div>
    </form>
  );
}
