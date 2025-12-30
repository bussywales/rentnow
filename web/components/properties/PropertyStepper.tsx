"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { PropertyCard } from "@/components/properties/PropertyCard";
import {
  createBrowserSupabaseClient,
  hasBrowserSupabaseEnv,
} from "@/lib/supabase/client";
import type { Property, PropertyStatus, RentalType } from "@/lib/types";
import { setToastQuery } from "@/lib/utils/toast";

type FormState = Partial<Property> & { amenitiesText?: string; featuresText?: string };

type Props = {
  initialData?: Partial<Property>;
  initialStep?: number;
};

const rentalTypes: { label: string; value: RentalType }[] = [
  { label: "Short-let", value: "short_let" },
  { label: "Long-term", value: "long_term" },
];

const STORAGE_BUCKET =
  process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET || "property-images";

const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

const steps = [
  { id: "basics", label: "Basics" },
  { id: "details", label: "Details" },
  { id: "photos", label: "Photos" },
  { id: "preview", label: "Preview" },
  { id: "submit", label: "Submit" },
];

export function PropertyStepper({ initialData, initialStep = 0 }: Props) {
  const router = useRouter();
  const [stepIndex, setStepIndex] = useState(
    Math.min(Math.max(initialStep, 0), steps.length - 1)
  );
  const [propertyId, setPropertyId] = useState<string | null>(
    initialData?.id || null
  );
  const [saving, startSaving] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [draftNotice, setDraftNotice] = useState<string | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [imageUrls, setImageUrls] = useState<string[]>(
    initialData?.images?.map((img) => img.image_url) || []
  );
  const [form, setForm] = useState<FormState>({
    rental_type: initialData?.rental_type ?? "long_term",
    currency: initialData?.currency ?? "USD",
    furnished: initialData?.furnished ?? false,
    bills_included: initialData?.bills_included ?? false,
    status: initialData?.status ?? "draft",
    amenitiesText: initialData?.amenities?.join(", ") ?? "",
    featuresText: initialData?.features?.join(", ") ?? "",
    ...initialData,
  });

  const lastAutoSaved = useRef<string>("");
  const autoSaveTimer = useRef<number | null>(null);

  const payload = useMemo(() => {
    return {
      ...form,
      amenities: form.amenitiesText
        ? form.amenitiesText.split(",").map((item) => item.trim()).filter(Boolean)
        : [],
      features: form.featuresText
        ? form.featuresText.split(",").map((item) => item.trim()).filter(Boolean)
        : [],
    };
  }, [form]);

  const canCreateDraft =
    !!payload.title &&
    !!payload.city &&
    !!payload.rental_type &&
    payload.price !== undefined &&
    payload.price !== null &&
    payload.currency &&
    payload.bedrooms !== undefined &&
    payload.bathrooms !== undefined;

  const getSupabase = useCallback(() => {
    if (!hasBrowserSupabaseEnv()) {
      setError("Supabase environment variables are missing. Connect Supabase to save.");
      return null;
    }
    return createBrowserSupabaseClient();
  }, [setError]);

  const saveDraft = useCallback(async (statusOverride?: PropertyStatus) => {
    if (!canCreateDraft) return;
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

    const status = statusOverride || (form.status as PropertyStatus) || "draft";
    const shouldIncludeStatus =
      !propertyId || !!statusOverride || status === "draft" || status === "paused";
    const requestBody = {
      ...payload,
      imageUrls,
      ...(shouldIncludeStatus
        ? { status, is_active: status === "pending" || status === "live" }
        : {}),
    };

    const requestKey = JSON.stringify(requestBody);
    if (!statusOverride && requestKey === lastAutoSaved.current) {
      return;
    }

    const url = propertyId ? `/api/properties/${propertyId}` : "/api/properties";
    const method = propertyId ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      credentials: "include",
      body: JSON.stringify(requestBody),
    });

    if (!res.ok) {
      const raw = await res.text().catch(() => "");
      let data: { code?: string; maxListings?: number; error?: string } | null = null;
      try {
        data = raw ? (JSON.parse(raw) as { code?: string; maxListings?: number; error?: string }) : null;
      } catch {
        data = null;
      }
      if (data?.code === "plan_limit_reached") {
        const limitMessage =
          typeof data?.maxListings === "number"
            ? ` Plan limit: ${data.maxListings}.`
            : "";
        throw new Error(`Plan limit reached.${limitMessage} Upgrade to add more listings.`);
      }
      throw new Error(data?.error || raw || "Unable to save draft.");
    }

    if (!propertyId) {
      const json = await res.json().catch(() => ({}));
      if (json?.id) {
        setPropertyId(json.id);
      }
    }

    lastAutoSaved.current = requestKey;
    setDraftNotice(status === "draft" ? "Draft saved." : null);
  }, [canCreateDraft, form.status, getSupabase, imageUrls, payload, propertyId, setDraftNotice, setError]);

  useEffect(() => {
    if (!canCreateDraft) return;
    if (autoSaveTimer.current) {
      window.clearTimeout(autoSaveTimer.current);
    }
    autoSaveTimer.current = window.setTimeout(() => {
      startSaving(() => {
        saveDraft().catch((err) => setError(err instanceof Error ? err.message : "Draft save failed."));
      });
    }, 1200);

    return () => {
      if (autoSaveTimer.current) {
        window.clearTimeout(autoSaveTimer.current);
      }
    };
  }, [canCreateDraft, saveDraft, setError, startSaving]);

  const handleChange = (key: keyof FormState, value: string | number | boolean) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const next = () => {
    setError(null);
    if (stepIndex === 0 && !canCreateDraft) {
      setError("Please complete the required basics before continuing.");
      return;
    }
    startSaving(() => {
      saveDraft()
        .then(() => setStepIndex((prev) => Math.min(prev + 1, steps.length - 1)))
        .catch((err) => setError(err instanceof Error ? err.message : "Unable to save draft."));
    });
  };

  const prev = () => {
    setError(null);
    setStepIndex((prev) => Math.max(prev - 1, 0));
  };

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

      if (blob.size >= file.size) return file;

      return new File([blob], file.name.replace(/\.[^.]+$/, ".webp"), {
        type: "image/webp",
        lastModified: Date.now(),
      });
    } catch {
      return file;
    }
  };

  const handleUpload = async () => {
    if (!files.length) return;
    setError(null);
    const supabase = getSupabase();
    if (!supabase) return;

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      setError("Please log in to upload photos.");
      return;
    }

    if (!STORAGE_BUCKET) {
      setError("Storage bucket is not configured.");
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    const uploaded: string[] = [];
    try {
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
        if (uploadError) throw new Error(uploadError.message);

        const { data: publicUrl } = supabase.storage
          .from(STORAGE_BUCKET)
          .getPublicUrl(path);
        uploaded.push(publicUrl.publicUrl);
        setUploadProgress(Math.round(((i + 1) / files.length) * 100));
      }
      setFiles([]);
      const nextUrls = [...imageUrls, ...uploaded];
      setImageUrls(nextUrls);
      await saveDraft();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to upload photos.");
    } finally {
      setUploading(false);
    }
  };

  const moveItem = <T,>(items: T[], index: number, direction: number) => {
    const next = [...items];
    const target = index + direction;
    if (target < 0 || target >= items.length) return items;
    [next[index], next[target]] = [next[target], next[index]];
    return next;
  };

  const handleSubmitForApproval = async () => {
    if (!propertyId) {
      setError("Save a draft before submitting.");
      return;
    }
    setError(null);
    startSaving(() => {
      saveDraft("pending")
        .then(() => {
          const params = new URLSearchParams();
          setToastQuery(params, "Listing submitted for approval", "success");
          router.push(`/dashboard?${params.toString()}`);
        })
        .catch((err) => setError(err instanceof Error ? err.message : "Unable to submit listing."));
    });
  };

  const stepLabel = steps[stepIndex]?.label || "Basics";

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
              Step {stepIndex + 1} of {steps.length}
            </p>
            <h2 className="text-lg font-semibold text-slate-900">{stepLabel}</h2>
          </div>
          {draftNotice && <p className="text-xs text-emerald-600">{draftNotice}</p>}
        </div>
        <div className="mt-3 grid gap-2 md:grid-cols-5">
          {steps.map((step, index) => (
            <div
              key={step.id}
              className={`rounded-full px-3 py-2 text-center text-xs font-semibold uppercase tracking-wide ${
                index <= stepIndex
                  ? "bg-sky-100 text-sky-700"
                  : "bg-slate-100 text-slate-500"
              }`}
            >
              {step.label}
            </div>
          ))}
        </div>
      </div>

      {error && <p className="text-sm text-rose-600">{error}</p>}

      {stepIndex === 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label htmlFor="listing-title" className="text-sm font-medium text-slate-700">
              Listing title
            </label>
            <Input
              id="listing-title"
              required
              value={form.title || ""}
              onChange={(e) => handleChange("title", e.target.value)}
              placeholder="e.g. Bright 2-bed in Lekki Phase 1"
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="rental-type" className="text-sm font-medium text-slate-700">
              Rental type
            </label>
            <Select
              id="rental-type"
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
            <label htmlFor="city" className="text-sm font-medium text-slate-700">
              City
            </label>
            <Input
              id="city"
              required
              value={form.city || ""}
              onChange={(e) => handleChange("city", e.target.value)}
              placeholder="Lagos, Nairobi, Accra..."
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="neighbourhood" className="text-sm font-medium text-slate-700">
              Neighbourhood
            </label>
            <Input
              id="neighbourhood"
              value={form.neighbourhood || ""}
              onChange={(e) => handleChange("neighbourhood", e.target.value)}
              placeholder="Lekki Phase 1"
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="address" className="text-sm font-medium text-slate-700">
              Address
            </label>
            <Input
              id="address"
              value={form.address || ""}
              onChange={(e) => handleChange("address", e.target.value)}
              placeholder="Street, building, house number"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <label htmlFor="latitude" className="text-sm font-medium text-slate-700">
                Latitude
              </label>
              <Input
                id="latitude"
                type="number"
                step="0.000001"
                value={form.latitude ?? ""}
                onChange={(e) => handleChange("latitude", Number(e.target.value))}
                placeholder="6.5244"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="longitude" className="text-sm font-medium text-slate-700">
                Longitude
              </label>
              <Input
                id="longitude"
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
              <label htmlFor="bedrooms" className="text-sm font-medium text-slate-700">
                Bedrooms
              </label>
              <Input
                id="bedrooms"
                type="number"
                min={0}
                value={form.bedrooms ?? 0}
                onChange={(e) => handleChange("bedrooms", Number(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="bathrooms" className="text-sm font-medium text-slate-700">
                Bathrooms
              </label>
              <Input
                id="bathrooms"
                type="number"
                min={0}
                value={form.bathrooms ?? 0}
                onChange={(e) => handleChange("bathrooms", Number(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="max-guests" className="text-sm font-medium text-slate-700">
                Max guests
              </label>
              <Input
                id="max-guests"
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
              <label htmlFor="price" className="text-sm font-medium text-slate-700">
                Price
              </label>
              <Input
                id="price"
                type="number"
                min={0}
                value={form.price ?? ""}
                onChange={(e) => handleChange("price", Number(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="currency" className="text-sm font-medium text-slate-700">
                Currency
              </label>
              <Input
                id="currency"
                value={form.currency || "USD"}
                onChange={(e) => handleChange("currency", e.target.value)}
                placeholder="USD / NGN / KES"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="available-from" className="text-sm font-medium text-slate-700">
                Available from
              </label>
              <Input
                id="available-from"
                type="date"
                value={form.available_from || ""}
                onChange={(e) => handleChange("available_from", e.target.value)}
              />
            </div>
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
      )}

      {stepIndex === 1 && (
        <div className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="description" className="text-sm font-medium text-slate-700">
              Description
            </label>
            <Textarea
              id="description"
              rows={5}
              value={form.description || ""}
              onChange={(e) => handleChange("description", e.target.value)}
              placeholder="Share highlights, who it's great for, and availability."
            />
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <label htmlFor="features" className="text-sm font-medium text-slate-700">
                Features
              </label>
              <Input
                id="features"
                value={form.featuresText || ""}
                onChange={(e) => handleChange("featuresText", e.target.value)}
                placeholder="balcony, generator, lift"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="epc-rating" className="text-sm font-medium text-slate-700">
                EPC rating
              </label>
              <Input
                id="epc-rating"
                value={form.epc_rating || ""}
                onChange={(e) => handleChange("epc_rating", e.target.value)}
                placeholder="A, B, C"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="council-tax-band" className="text-sm font-medium text-slate-700">
                Council tax band
              </label>
              <Input
                id="council-tax-band"
                value={form.council_tax_band || ""}
                onChange={(e) => handleChange("council_tax_band", e.target.value)}
                placeholder="Band D"
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <input
              id="bills_included"
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300 text-sky-600"
              checked={!!form.bills_included}
              onChange={(e) => handleChange("bills_included", e.target.checked)}
            />
            <label htmlFor="bills_included" className="text-sm text-slate-700">
              Bills included
            </label>
          </div>
          <div className="space-y-2">
            <label htmlFor="amenities" className="text-sm font-medium text-slate-700">
              Amenities
            </label>
            <Input
              id="amenities"
              value={form.amenitiesText || ""}
              onChange={(e) => handleChange("amenitiesText", e.target.value)}
              placeholder="wifi, parking, security, pool"
            />
          </div>
        </div>
      )}

      {stepIndex === 2 && (
        <div className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="photo-upload" className="text-sm font-medium text-slate-700">
              Photos (Supabase Storage)
            </label>
            <input
              id="photo-upload"
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => setFiles(Array.from(e.target.files || []))}
              className="w-full rounded-lg border border-dashed border-slate-300 bg-white px-4 py-3 text-sm text-slate-700"
            />
            {files.length > 0 && (
              <div className="space-y-2 text-xs text-slate-600">
                {files.map((file, index) => (
                  <div key={file.name} className="flex items-center justify-between gap-2">
                    <span>{file.name}</span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="text-slate-500 hover:text-slate-900"
                        onClick={() => setFiles((prev) => moveItem(prev, index, -1))}
                      >
                        Up
                      </button>
                      <button
                        type="button"
                        className="text-slate-500 hover:text-slate-900"
                        onClick={() => setFiles((prev) => moveItem(prev, index, 1))}
                      >
                        Down
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <p className="text-xs text-slate-600">
              Max 20MB per file (auto-compressed before upload). Uploads go to the `{STORAGE_BUCKET}` bucket.
            </p>
            {uploading && (
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full bg-sky-500 transition-all"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            )}
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={!files.length || uploading}
              onClick={handleUpload}
            >
              {uploading ? "Uploading..." : "Upload photos"}
            </Button>
          </div>

          {imageUrls.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-slate-700">Photo ordering</p>
              <div className="space-y-2 text-xs text-slate-600">
                {imageUrls.map((url, index) => (
                  <div key={url} className="flex items-center justify-between gap-2">
                    <span className="truncate">{url}</span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="text-slate-500 hover:text-slate-900"
                        onClick={() => setImageUrls((prev) => moveItem(prev, index, -1))}
                      >
                        Up
                      </button>
                      <button
                        type="button"
                        className="text-slate-500 hover:text-slate-900"
                        onClick={() => setImageUrls((prev) => moveItem(prev, index, 1))}
                      >
                        Down
                      </button>
                      <button
                        type="button"
                        className="text-rose-500 hover:text-rose-700"
                        onClick={() =>
                          setImageUrls((prev) => prev.filter((item) => item !== url))
                        }
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {stepIndex === 3 && (
        <div className="space-y-4">
          <PropertyCard
            property={{
              id: propertyId || "preview",
              owner_id: form.owner_id || "preview-owner",
              title: form.title || "Listing title",
              description: form.description || "Add a description in the details step.",
              city: form.city || "City",
              neighbourhood: form.neighbourhood || null,
              address: form.address || null,
              latitude: form.latitude || null,
              longitude: form.longitude || null,
              rental_type: form.rental_type || "long_term",
              price: form.price || 0,
              currency: form.currency || "USD",
              bedrooms: form.bedrooms || 0,
              bathrooms: form.bathrooms || 0,
              furnished: !!form.furnished,
              amenities:
                payload.amenities && payload.amenities.length ? payload.amenities : null,
              images: imageUrls.map((url, index) => ({
                id: `preview-${index}`,
                image_url: url,
              })),
            }}
          />
          <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700 shadow-sm">
            <p className="font-semibold text-slate-900">Preview checklist</p>
            <ul className="mt-2 space-y-1">
              <li>Title, price, and location filled</li>
              <li>{imageUrls.length ? `${imageUrls.length} photo(s) added` : "Add photos"}</li>
              <li>Description and amenities updated</li>
            </ul>
          </div>
        </div>
      )}

      {stepIndex === 4 && (
        <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900">Ready to submit?</h3>
          <p className="text-sm text-slate-600">
            Submitting sends your listing for admin review. It will go live after approval.
          </p>
          <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-700">
            <p className="font-semibold">Before you submit:</p>
            <ul className="mt-2 space-y-1">
              <li>Ensure contact details are correct in your profile.</li>
              <li>Upload at least one high-quality photo.</li>
              <li>Provide a clear description and amenities.</li>
            </ul>
          </div>
          <Button onClick={handleSubmitForApproval} disabled={saving || !propertyId}>
            {saving ? "Submitting..." : "Submit for approval"}
          </Button>
        </div>
      )}

      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={prev} disabled={stepIndex === 0}>
          Back
        </Button>
        <Button
          onClick={next}
          disabled={stepIndex >= steps.length - 1 || saving}
        >
          {stepIndex >= steps.length - 1 ? "Done" : "Next"}
        </Button>
      </div>
    </div>
  );
}
