"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CurrencySelect } from "@/components/properties/CurrencySelect";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { normalizeCountryCode } from "@/lib/countries";
import { getHostListingIntentOptions, isSaleIntent } from "@/lib/listing-intents";
import { requiresRooms } from "@/lib/properties/listing-types";
import {
  createBrowserSupabaseClient,
  hasBrowserSupabaseEnv,
} from "@/lib/supabase/client";
import type { ListingIntent, Property, RentalType } from "@/lib/types";
import { setToastQuery } from "@/lib/utils/toast";

type FormState = Partial<Property> & { amenitiesText?: string };

type Props = {
  initialData?: Partial<Property>;
  onSubmit?: (data: FormState) => Promise<void> | void;
};

const MAX_UPLOAD_BYTES = 20 * 1024 * 1024; // 20MB client-side limit
const rentalTypes: { label: string; value: RentalType }[] = [
  { label: "Short-let", value: "short_let" },
  { label: "Long-term", value: "long_term" },
];
const listingIntents: { label: string; value: ListingIntent }[] = getHostListingIntentOptions();

const STORAGE_BUCKET =
  process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET || "property-images";

export function PropertyForm({ initialData, onSubmit }: Props) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const [form, setForm] = useState<FormState>({
    rental_type: "long_term",
    listing_intent: "rent",
    currency: "USD",
    is_demo: initialData?.is_demo ?? false,
    amenitiesText: initialData?.amenities?.join(", ") ?? "",
    ...initialData,
    rent_period: initialData?.rent_period ?? "monthly",
  });
  const isSaleListing = isSaleIntent(form.listing_intent);
  const roomsRequired = requiresRooms(form.listing_type);
  const showRoomOptionalHint = !!form.listing_type && !roomsRequired;
  const [aiLoading, setAiLoading] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const compressImage = async (file: File) => {
    try {
      const objectUrl = URL.createObjectURL(file);
      const img = new Image();
      img.src = objectUrl;
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("Image load failed"));
      });
      URL.revokeObjectURL(objectUrl);

      const maxDim = 2000;
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const targetW = Math.max(1, Math.round(img.width * scale));
      const targetH = Math.max(1, Math.round(img.height * scale));

      const canvas = document.createElement("canvas");
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas not supported");
      ctx.drawImage(img, 0, 0, targetW, targetH);

      const blob: Blob | null = await new Promise((resolve) =>
        canvas.toBlob(resolve, "image/webp", 0.72)
      );
      if (!blob) throw new Error("Compression failed");

      // If somehow bigger than original, keep the original file.
      if (blob.size >= file.size) return file;

      return new File([blob], file.name.replace(/\.[^.]+$/, ".webp"), {
        type: "image/webp",
        lastModified: Date.now(),
      });
    } catch {
      // On any compression failure, fall back to the original file.
      return file;
    }
  };

  const getSupabase = () => {
    if (!hasBrowserSupabaseEnv()) {
      setError("Supabase environment variables are missing. Connect Supabase to save.");
      return null;
    }
    return createBrowserSupabaseClient();
  };

  const handleChange = (key: keyof FormState, value: string | number | boolean | null) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const normalizeOptionalString = (value?: string | null) => {
    if (!value) return null;
    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    const payload: FormState = {
      ...form,
      country: normalizeOptionalString(form.country),
      country_code: normalizeCountryCode(form.country_code),
      state_region: normalizeOptionalString(form.state_region),
      neighbourhood: normalizeOptionalString(form.neighbourhood),
      address: normalizeOptionalString(form.address),
      amenities: form.amenitiesText
        ? form.amenitiesText.split(",").map((a) => a.trim()).filter(Boolean)
        : [],
      rent_period: form.listing_intent === "buy" ? null : form.rent_period ?? "monthly",
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

        const {
          data: { session },
        } = await supabase.auth.getSession();
        const accessToken = session?.access_token;

        if (initialData?.owner_id && initialData.owner_id !== user.id) {
          setError("You can only edit listings you own. Create a new listing to duplicate this data.");
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
            if (file.size > MAX_UPLOAD_BYTES) {
              throw new Error(`File ${file.name} exceeds ${MAX_UPLOAD_BYTES / (1024 * 1024)}MB limit.`);
            }
            if (!file.type.startsWith("image/")) {
              throw new Error(`File ${file.name} is not an image.`);
            }
            const toUpload = await compressImage(file);
            const path = `${user.id}/${Date.now()}-${toUpload.name}`;
            const { error: uploadError } = await supabase.storage
              .from(STORAGE_BUCKET)
              .upload(path, toUpload);
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
          headers: {
            "Content-Type": "application/json",
            ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
          },
          credentials: "include",
          body: JSON.stringify({
            ...payload,
            imageUrls: uploadedUrls,
          }),
        });

        if (!res.ok) {
          let errText = await res.text();
          try {
            const parsed = JSON.parse(errText);
            errText = parsed?.error || errText;
          } catch {
            /* ignore JSON parse failure */
          }
          throw new Error(errText || "Unable to save listing.");
        }

        const params = new URLSearchParams();
        setToastQuery(params, "Listing saved successfully", "success");
        router.push(`/dashboard?${params.toString()}`);
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
          listingIntent: form.listing_intent ?? "rent",
          listingType: form.listing_type ?? undefined,
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
          <label className="text-sm font-medium text-slate-700">Listing intent</label>
          <Select
            value={form.listing_intent ?? "rent"}
            onChange={(e) => {
              const nextIntent = e.target.value as ListingIntent;
              handleChange("listing_intent", nextIntent);
              if (isSaleIntent(nextIntent)) {
                handleChange("rent_period", null);
              } else if (!form.rent_period) {
                handleChange("rent_period", "monthly");
              }
            }}
          >
            {listingIntents.map((intent) => (
              <option key={intent.value} value={intent.value}>
                {intent.label}
              </option>
            ))}
          </Select>
          <p className="text-xs text-slate-500">
            Is this listing for renting/leasing or for selling (for sale)?
          </p>
        </div>
        {!isSaleListing && (
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
        )}
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
          <label className="text-sm font-medium text-slate-700">Country / Region</label>
          <Input
            value={form.country || ""}
            onChange={(e) => handleChange("country", e.target.value)}
            placeholder="Nigeria"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700">State / Region</label>
          <Input
            value={form.state_region || ""}
            onChange={(e) => handleChange("state_region", e.target.value)}
            placeholder="Lagos State"
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
            {showRoomOptionalHint && (
              <p className="text-xs text-slate-500">Use 0 if not applicable.</p>
            )}
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Bathrooms</label>
            <Input
              type="number"
              min={0}
              value={form.bathrooms ?? 0}
              onChange={(e) => handleChange("bathrooms", Number(e.target.value))}
            />
            {showRoomOptionalHint && (
              <p className="text-xs text-slate-500">Use 0 if not applicable.</p>
            )}
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
        <div className="grid gap-3 md:grid-cols-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Price</label>
            <Input
              type="number"
              min={1}
              value={form.price ?? ""}
              onChange={(e) => handleChange("price", Number(e.target.value))}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Currency</label>
            <CurrencySelect
              value={form.currency || "USD"}
              onChange={(value) => handleChange("currency", value)}
              placeholder="Search currency codes"
            />
          </div>
          {form.listing_intent !== "buy" ? (
            <div className="space-y-2">
              <span className="text-sm font-medium text-slate-700">Rent period</span>
              <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="rent_period"
                    value="monthly"
                    checked={(form.rent_period ?? "monthly") === "monthly"}
                    onChange={() => handleChange("rent_period", "monthly")}
                  />
                  Monthly
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="rent_period"
                    value="yearly"
                    checked={form.rent_period === "yearly"}
                    onChange={() => handleChange("rent_period", "yearly")}
                  />
                  Yearly
                </label>
              </div>
              <p className="text-xs text-slate-500">How often is rent paid?</p>
            </div>
          ) : (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
              Sale listings use a total price. No rent cadence is required.
            </div>
          )}
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
        <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 md:col-span-2">
          <label className="flex items-start gap-3">
            <input
              id="is-demo"
              type="checkbox"
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-sky-600"
              checked={!!form.is_demo}
              onChange={(e) => handleChange("is_demo", e.target.checked)}
            />
            <span>
              <span className="block text-sm font-medium text-slate-800">
                Mark as demo listing
              </span>
              <span className="block text-xs text-slate-600">
                Demo listings are labelled and excluded from customer-facing promotions. Admins
                control whether badges and watermarks are shown.
              </span>
            </span>
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
        <p className="text-xs text-slate-600">
          Max 20MB per file (auto-compressed before upload), images only. Uploads go to the `{STORAGE_BUCKET}` bucket (set `NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET`).
        </p>
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
