"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import NextImage from "next/image";
import { CurrencySelect } from "@/components/properties/CurrencySelect";
import { CountrySelect } from "@/components/properties/CountrySelect";
import { getCountryByCode, getCountryByName } from "@/lib/countries";
import { normalizeCountryCode } from "@/lib/countries";
import { classifyCoverHint, type ImageMeta as CoverMeta } from "@/lib/properties/cover-hint";
import { pickRecommendedCover } from "@/lib/properties/recommended-cover";
import { Button } from "@/components/ui/Button";
import InfoPopover from "@/components/ui/InfoPopover";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { LocationQualityCard } from "@/components/properties/LocationQualityCard";
import { PrePublishNudgeCard } from "@/components/properties/PrePublishNudgeCard";
import { PropertyCard } from "@/components/properties/PropertyCard";
import {
  createBrowserSupabaseClient,
  hasBrowserSupabaseEnv,
} from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
import type {
  BathroomType,
  ListingType,
  Property,
  PropertyStatus,
  RentalType,
  SizeUnit,
} from "@/lib/types";
import { setToastQuery } from "@/lib/utils/toast";
import { labelForField } from "@/lib/forms/listing-errors";
import { hasPinnedLocation } from "@/lib/properties/validation";
import { LOCATION_MICROCOPY } from "@/lib/location-microcopy";
import { computeLocationQuality } from "@/lib/properties/location-quality";
import { sanitizePostalCode } from "@/lib/geocode/normalize-location";
import { buildStaticMapUrl } from "@/lib/geocode/staticMap";
import {
  buildCountryHintKey,
  classifyLocationQuery,
  countryCodeFromQueryType,
  countryNameFromCode,
  inferCountryFromResults,
  shouldShowCountryCta,
} from "@/lib/location/search-hints";
import {
  buildPrePublishNudges,
  type PrePublishNudgeAction,
} from "@/lib/properties/prepublish-nudge";
import { SaveStatusPill } from "@/components/properties/SaveStatusPill";
import { useSaveStatus } from "@/components/properties/useSaveStatus";
import { SAVE_STATUS_COPY } from "@/lib/properties/save-status-microcopy";
import { ALLOWED_VIDEO_TYPES, VIDEO_BUCKET, isAllowedVideoSize, isAllowedVideoType } from "@/lib/properties/video";
import { ReviewAndPublishCard } from "@/components/properties/ReviewAndPublishCard";
import {
  buildReviewAndPublishChecklist,
  type ReviewActionTarget,
} from "@/lib/properties/review-publish";
import { formatRelativeTime } from "@/lib/date/relative-time";
import { buildEditorUrl } from "@/lib/properties/host-dashboard";
import { normalizeFocusParam, normalizeStepParam, STEP_IDS, type StepId } from "@/lib/properties/step-params";

type FormState = Partial<Property> & { amenitiesText?: string; featuresText?: string };
type ResolvedAuth = {
  user: User | null;
  accessToken: string | null;
  error: Error | null | undefined;
};

type ImageMeta = CoverMeta & {
  bytes?: number | null;
  format?: string | null;
  exif_has_gps?: boolean | null;
  exif_captured_at?: string | null;
  exif?: { hasGps?: boolean | null; capturedAt?: string | null };
};
type RecommendedSuggestion = {
  url: string | null;
  reason: string;
  isAlreadyCover?: boolean;
  quality?: {
    width?: number | null;
    height?: number | null;
    meets1600x900?: boolean | null;
    isPortrait?: boolean | null;
  };
  source: "api" | "local";
};
type Props = {
  initialData?: Partial<Property>;
  initialStep?: number | StepId;
  enableLocationPicker?: boolean;
  initialFocus?: "location" | "photos" | null;
  requireLocationPinForPublish?: boolean;
};

const rentalTypes: { label: string; value: RentalType }[] = [
  { label: "Short-let", value: "short_let" },
  { label: "Long-term", value: "long_term" },
];

const listingTypes: { label: string; value: ListingType }[] = [
  { label: "Apartment", value: "apartment" },
  { label: "House", value: "house" },
  { label: "Duplex", value: "duplex" },
  { label: "Bungalow", value: "bungalow" },
  { label: "Studio", value: "studio" },
  { label: "Room", value: "room" },
  { label: "Shop", value: "shop" },
  { label: "Office", value: "office" },
  { label: "Land", value: "land" },
];

const bathroomTypes: { label: string; value: BathroomType }[] = [
  { label: "Private", value: "private" },
  { label: "Shared", value: "shared" },
];

const sizeUnits: { label: string; value: SizeUnit }[] = [
  { label: "sqm", value: "sqm" },
  { label: "sqft", value: "sqft" },
];

const STORAGE_BUCKET =
  process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET || "property-images";

const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
const COORDINATES_HELP = {
  title: "How to find coordinates",
  bullets: [
    "Google Maps (recommended): Search the address, right-click the pin, then click the numbers to copy.",
    "On mobile: Drop a pin, swipe up, then copy the coordinates.",
    "Tip: Latitude is like 51.50…, longitude is like -0.12….",
  ],
};

const steps: Array<{ id: StepId; label: string }> = [
  { id: "basics", label: "Basics" },
  { id: "details", label: "Details" },
  { id: "photos", label: "Photos" },
  { id: "preview", label: "Preview" },
  { id: "submit", label: "Submit" },
];
const STEP_FIELDS: Record<(typeof steps)[number]["id"], Array<keyof FormState | "imageUrls" | "cover_image_url">> = {
  basics: ["title", "rental_type", "city", "price", "currency", "bedrooms", "bathrooms"],
  details: [
    "listing_type",
    "state_region",
    "neighbourhood",
    "address",
    "latitude",
    "longitude",
    "location_label",
    "location_place_id",
    "location_source",
    "location_precision",
    "size_value",
    "size_unit",
    "year_built",
    "bathroom_type",
    "deposit_amount",
    "deposit_currency",
    "pets_allowed",
    "furnished",
    "bills_included",
    "amenitiesText",
    "featuresText",
    "rent_period",
    "available_from",
    "max_guests",
  ],
  photos: ["imageUrls", "cover_image_url"],
  preview: [],
  submit: [],
};

export function PropertyStepper({
  initialData,
  initialStep = 0,
  enableLocationPicker = false,
  initialFocus = null,
  requireLocationPinForPublish = false,
}: Props) {
  const router = useRouter();
  const normalizedInitialStepId: StepId = useMemo(() => {
    if (typeof initialStep === "string") {
      return normalizeStepParam(initialStep);
    }
    if (typeof initialStep === "number") {
      const clampedIndex = Math.min(Math.max(initialStep, 0), STEP_IDS.length - 1);
      return normalizeStepParam(STEP_IDS[clampedIndex]);
    }
    if (typeof window !== "undefined") {
      const fromQuery = new URLSearchParams(window.location.search).get("step");
      return normalizeStepParam(fromQuery);
    }
    return "basics";
  }, [initialStep]);

  const initialStepIndex = useMemo(() => {
    const idx = steps.findIndex((step) => step.id === normalizedInitialStepId);
    return idx >= 0 ? idx : 0;
  }, [normalizedInitialStepId]);

  const [stepIndex, setStepIndex] = useState(() => initialStepIndex);
  const [propertyId, setPropertyId] = useState<string | null>(
    initialData?.id || null
  );
  const [saving, startSaving] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [draftNotice, setDraftNotice] = useState<string | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [aiLoading, setAiLoading] = useState(false);
  const [imageUrls, setImageUrls] = useState<string[]>(
    initialData?.images?.map((img) => img.image_url) || []
  );
  const initialImageMeta = useMemo(() => {
    const meta: Record<string, ImageMeta> = {};
    initialData?.images?.forEach((img) => {
      meta[img.image_url] = {
        width: (img as { width?: number | null }).width ?? null,
        height: (img as { height?: number | null }).height ?? null,
        bytes: (img as { bytes?: number | null }).bytes ?? null,
        format: (img as { format?: string | null }).format ?? null,
        exif_has_gps: (img as { exif_has_gps?: boolean | null }).exif_has_gps ?? null,
        exif_captured_at: (img as { exif_captured_at?: string | null }).exif_captured_at ?? null,
        exif: {
          hasGps: (img as { exif_has_gps?: boolean | null }).exif_has_gps ?? null,
          capturedAt: (img as { exif_captured_at?: string | null }).exif_captured_at ?? null,
        },
      };
    });
    return meta;
  }, [initialData?.images]);
  const [imageMeta, setImageMeta] = useState<Record<string, ImageMeta>>(initialImageMeta);
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(
    initialData?.cover_image_url ??
      initialData?.images?.[0]?.image_url ??
      null
  );
  const [coverWarning, setCoverWarning] = useState<{
    tooSmall: boolean;
    portrait: boolean;
    unknown: boolean;
  }>({
    tooSmall: false,
    portrait: false,
    unknown: true,
  });
  const [videoUrl, setVideoUrl] = useState<string | null>(
    initialData?.property_videos?.[0]?.video_url ?? null
  );
  const [videoUploading, setVideoUploading] = useState(false);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [recommended, setRecommended] = useState<RecommendedSuggestion | null>(null);
  const [recommendedDismissed, setRecommendedDismissed] = useState(false);
  const {
    status: saveStatus,
    setSaving: markSaving,
    setSaved: markSaved,
    setError: markSaveError,
    setSubmitting: markSubmitting,
    setSubmitted: markSubmitted,
    retry: retrySave,
  } = useSaveStatus(propertyId);
  const syncCoverWithImages = useCallback((next: string[]) => {
    setCoverImageUrl((prev) => {
      if (!next.length) return null;
      if (prev && next.includes(prev)) return prev;
      return next[0];
    });
    setImageMeta((prev) => {
      const nextMeta: Record<string, ImageMeta> = {};
      next.forEach((url) => {
        if (prev[url]) nextMeta[url] = prev[url];
      });
      return nextMeta;
    });
  }, []);
  const readImageMetaFromFile = useCallback(async (file: File): Promise<ImageMeta> => {
    const meta: ImageMeta = {
      bytes: file.size,
      format: file.type || null,
    };
    try {
      const objectUrl = URL.createObjectURL(file);
      await new Promise<void>((resolve) => {
        const img = new Image();
        img.onload = () => {
          meta.width = img.naturalWidth;
          meta.height = img.naturalHeight;
          URL.revokeObjectURL(objectUrl);
          resolve();
        };
        img.onerror = () => {
          URL.revokeObjectURL(objectUrl);
          resolve();
        };
        img.src = objectUrl;
      });
    } catch {
      // ignore failures, leave meta partial
    }
    return meta;
  }, []);

  useEffect(() => {
    if (!imageUrls.length) {
      setCoverImageUrl(null);
      return;
    }
    setCoverImageUrl((prev) => {
      if (prev && imageUrls.includes(prev)) return prev;
      return imageUrls[0] ?? null;
    });
  }, [imageUrls]);
  const currentStepId = steps[stepIndex].id;
  const currentFieldErrors = useMemo(() => {
    const keys = STEP_FIELDS[currentStepId] ?? [];
    const entries = Object.entries(fieldErrors).filter(([key]) =>
      keys.includes(key as keyof FormState | "imageUrls" | "cover_image_url")
    );
    return Object.fromEntries(entries);
  }, [currentStepId, fieldErrors]);

  const [form, setForm] = useState<FormState>({
    rental_type: initialData?.rental_type ?? "long_term",
    currency: initialData?.currency ?? "USD",
    listing_type: initialData?.listing_type ?? null,
    country: initialData?.country ?? null,
    country_code: initialData?.country_code ?? null,
    state_region: initialData?.state_region ?? null,
    size_value: initialData?.size_value ?? null,
    size_unit: initialData?.size_unit ?? "sqm",
    year_built: initialData?.year_built ?? null,
    deposit_amount: initialData?.deposit_amount ?? null,
    deposit_currency: initialData?.deposit_currency ?? null,
    bathroom_type: initialData?.bathroom_type ?? null,
    pets_allowed: initialData?.pets_allowed ?? false,
    furnished: initialData?.furnished ?? false,
    bills_included: initialData?.bills_included ?? false,
    status: initialData?.status ?? "draft",
    amenitiesText: initialData?.amenities?.join(", ") ?? "",
    featuresText: initialData?.features?.join(", ") ?? "",
    location_label: initialData?.location_label ?? null,
    location_place_id: initialData?.location_place_id ?? null,
    location_source: initialData?.location_source ?? null,
    location_precision: initialData?.location_precision ?? null,
    ...initialData,
    rent_period: initialData?.rent_period ?? "monthly",
  });
  const [locationQuery, setLocationQuery] = useState(form.location_label || "");
  const [locationResults, setLocationResults] = useState<
    Array<{
      label: string;
      place_id: string;
      lat: number;
      lng: number;
      region_name?: string | null;
      place_name?: string | null;
      district_name?: string | null;
      locality_name?: string | null;
      neighborhood_name?: string | null;
      country_code?: string | null;
      country_name?: string | null;
      admin_area_1?: string | null;
      admin_area_2?: string | null;
      locality?: string | null;
      sublocality?: string | null;
      postal_code?: string | null;
    }>
  >([]);
  const [locationSearching, setLocationSearching] = useState(false);
  const [locationSearched, setLocationSearched] = useState(false);
  const [showAdvancedLocation, setShowAdvancedLocation] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [autoFillHints, setAutoFillHints] = useState<{
    country?: boolean;
    city?: boolean;
    state?: boolean;
    neighbourhood?: boolean;
    admin_area_2?: boolean;
    postal_code?: boolean;
  }>({});
  const [userEdited, setUserEdited] = useState<{
    country?: boolean;
    city?: boolean;
    state_region?: boolean;
    neighbourhood?: boolean;
    admin_area_2?: boolean;
    postal_code?: boolean;
  }>({});
  const initialCheckinSignal = (initialData as Record<string, unknown>)?.checkin_signal as
    | { status?: string; bucket?: string | null; checkedInAt?: string | null }
    | undefined;
  const [checkinInfo, setCheckinInfo] = useState<{
    bucket: string | null;
    checkedInAt: string | null;
  } | null>(
    initialCheckinSignal && initialCheckinSignal.status && initialCheckinSignal.status !== "hidden"
      ? {
          bucket: initialCheckinSignal.bucket ?? null,
          checkedInAt: initialCheckinSignal.checkedInAt ?? null,
        }
      : null
  );
  const [checkinMessage, setCheckinMessage] = useState<string | null>(null);
  const [checkinLoading, setCheckinLoading] = useState(false);
  const [locationPublishError, setLocationPublishError] = useState(false);
  const locationSectionRef = useRef<HTMLDivElement | null>(null);
  const locationSearchInputRef = useRef<HTMLInputElement | null>(null);
  const countryButtonRef = useRef<HTMLButtonElement | null>(null);
  const videoInputRef = useRef<HTMLInputElement | null>(null);
  const [locationActiveIndex, setLocationActiveIndex] = useState(0);
  const [dismissedCountryHintKey, setDismissedCountryHintKey] = useState<string | null>(null);
  const [prepublishDismissed, setPrepublishDismissed] = useState(false);
  const [reviewDismissed, setReviewDismissed] = useState(false);
  const hasAppliedInitialFocus = useRef(false);
  const resolvedInitialFocus = useMemo(() => {
    if (initialFocus) return initialFocus;
    if (typeof window !== "undefined") {
      const fromQuery = new URLSearchParams(window.location.search).get("focus");
      return normalizeFocusParam(fromQuery);
    }
    return null;
  }, [initialFocus]);

  useEffect(() => {
    if (!enableLocationPicker) return;
    setLocationError(null);
    const controller = new AbortController();
    const query = locationQuery.trim();
    if (query.length < 3) {
      setLocationResults([]);
      setLocationSearched(false);
      return () => controller.abort();
    }
    setLocationSearched(false);
    const timeout = window.setTimeout(async () => {
      setLocationSearching(true);
      try {
        const params = new URLSearchParams({ q: query });
        const countryBias = normalizeCountryCode(form.country_code);
        if (countryBias) params.set("country_code", countryBias.toLowerCase());
        if (form.latitude && form.longitude) {
          params.set("pin_lat", String(form.latitude));
          params.set("pin_lng", String(form.longitude));
        }
        const res = await fetch(`/api/geocode?${params.toString()}`, {
          signal: controller.signal,
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          if (data?.code === "MAPBOX_NOT_CONFIGURED") {
            setLocationError(
              "Location search isn't configured yet (MAPBOX_TOKEN missing). You can still enter location fields manually below."
            );
          } else {
            setLocationError("Location search failed. Try again.");
          }
          setLocationResults([]);
          setLocationSearched(false);
          return;
        }
        const data = (await res.json()) as Array<{
          label: string;
          place_id: string;
          lat: number;
          lng: number;
          region_name?: string | null;
          place_name?: string | null;
          district_name?: string | null;
          locality_name?: string | null;
          neighborhood_name?: string | null;
          country_code?: string | null;
          country_name?: string | null;
        }>;
        setLocationResults(data || []);
        setLocationSearched(true);
        setLocationError(null);
      } catch (err) {
        if (!(err instanceof DOMException && err.name === "AbortError")) {
          console.warn("geocode search failed", err);
          setLocationError("Location search failed. Try again.");
        }
      } finally {
        setLocationSearching(false);
      }
    }, 400);
    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [enableLocationPicker, form.country_code, form.latitude, form.longitude, locationQuery]);

  const lastAutoSaved = useRef<string>("");
  const autoSaveTimer = useRef<number | null>(null);
  const authResolveRef = useRef<Promise<ResolvedAuth> | null>(null);
  const lastPersistedCover = useRef<string | null>(null);

  const normalizeOptionalString = (value?: string | null) => {
    if (!value) return null;
    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
  };

  const payload = useMemo(() => {
    const sizeValue =
      typeof form.size_value === "number" && Number.isFinite(form.size_value)
        ? form.size_value
        : null;
    const depositAmount =
      typeof form.deposit_amount === "number" && Number.isFinite(form.deposit_amount)
        ? form.deposit_amount
        : null;

    return {
      ...form,
      listing_type: normalizeOptionalString(form.listing_type),
      country: normalizeOptionalString(form.country),
      country_code: normalizeCountryCode(form.country_code),
      state_region: normalizeOptionalString(form.state_region),
      admin_area_1: normalizeOptionalString(form.admin_area_1 ?? form.state_region),
      admin_area_2: normalizeOptionalString(form.admin_area_2),
      postal_code: normalizeOptionalString(
        sanitizePostalCode(form.country_code ?? null, form.postal_code ?? null)
      ),
      city: normalizeOptionalString(form.city),
      neighbourhood: normalizeOptionalString(form.neighbourhood),
      address: normalizeOptionalString(form.address),
      location_label: normalizeOptionalString(form.location_label),
      location_place_id: normalizeOptionalString(form.location_place_id),
      location_source: normalizeOptionalString(form.location_source),
      location_precision: normalizeOptionalString(form.location_precision),
      size_value: sizeValue ?? undefined,
      size_unit: sizeValue ? form.size_unit ?? "sqm" : undefined,
      year_built:
        typeof form.year_built === "number" && Number.isFinite(form.year_built)
          ? form.year_built
          : null,
      deposit_amount: depositAmount ?? undefined,
      deposit_currency: depositAmount
        ? form.deposit_currency ?? form.currency ?? null
        : undefined,
      bathroom_type: normalizeOptionalString(form.bathroom_type),
      pets_allowed: !!form.pets_allowed,
      amenities: form.amenitiesText
        ? form.amenitiesText.split(",").map((item) => item.trim()).filter(Boolean)
        : [],
      features: form.featuresText
        ? form.featuresText.split(",").map((item) => item.trim()).filter(Boolean)
        : [],
      cover_image_url: coverImageUrl ?? undefined,
    };
  }, [form, coverImageUrl]);

  const locationQuality = useMemo(
    () =>
      computeLocationQuality({
        latitude: form.latitude ?? null,
        longitude: form.longitude ?? null,
        location_label: form.location_label ?? null,
        location_place_id: form.location_place_id ?? null,
        country_code: form.country_code ?? null,
        admin_area_1: form.admin_area_1 ?? form.state_region ?? null,
        admin_area_2: form.admin_area_2 ?? null,
        postal_code: form.postal_code ?? null,
        city: form.city ?? null,
      }),
    [
      form.admin_area_1,
      form.admin_area_2,
      form.city,
      form.country_code,
      form.latitude,
      form.location_label,
      form.location_place_id,
      form.longitude,
      form.postal_code,
      form.state_region,
    ]
  );
  const searchCountryName =
    countryNameFromCode(form.country_code ?? null) || (form.country ?? null);
  const hasCountrySelected =
    !!(form.country_code && form.country_code.trim()) ||
    !!(form.country && form.country.trim());
  const countryHint = useMemo(() => {
    const queryType = classifyLocationQuery(locationQuery);
    const fromQuery = countryCodeFromQueryType(queryType);
    const fromResults = inferCountryFromResults(locationResults);
    const countryCode = queryType !== "NONE" ? fromQuery ?? fromResults : null;
    const countryName = countryNameFromCode(countryCode);
    const key = queryType !== "NONE" ? buildCountryHintKey(queryType, countryCode) : null;
    return { queryType, countryCode, countryName, key };
  }, [locationQuery, locationResults]);
  const hasPin =
    hasPinnedLocation({
      latitude: form.latitude ?? null,
      longitude: form.longitude ?? null,
      location_label: form.location_label ?? null,
      location_place_id: form.location_place_id ?? null,
    }) || false;
  const prepublishNudges = useMemo(
    () =>
      buildPrePublishNudges({
        locationQuality,
        photoCount: imageUrls.length,
        coverImageUrl: coverImageUrl ?? null,
        coverWarning,
        recommendedCoverUrl: recommended?.url ?? null,
        recommendedDismissed,
      }),
    [coverImageUrl, coverWarning, imageUrls.length, locationQuality, recommended?.url, recommendedDismissed]
  );
  const countryCtaMessage = useMemo(() => {
    if (!countryHint.key) return null;
    if (countryHint.countryCode === "GB") return LOCATION_MICROCOPY.cta.countryHint.uk;
    if (countryHint.countryCode === "US") return LOCATION_MICROCOPY.cta.countryHint.us;
    if (countryHint.countryCode === "CA") return LOCATION_MICROCOPY.cta.countryHint.ca;
    if (countryHint.key === "GENERIC_POSTAL_LIKE") return LOCATION_MICROCOPY.cta.countryHint.generic;
    return null;
  }, [countryHint.countryCode, countryHint.key]);
  const countryCtaButtonLabel = countryHint.countryName
    ? `${LOCATION_MICROCOPY.cta.countryHint.buttonPrefix} ${countryHint.countryName}`
    : "Set country";
  const showCountryCta =
    shouldShowCountryCta({
      countrySelected: hasCountrySelected,
      ctaKey: countryHint.key,
      dismissedKey: dismissedCountryHintKey,
    }) &&
    !locationError &&
    !locationSearching &&
    !!countryHint.key &&
    !!countryCtaMessage;
  useEffect(() => {
    if (!hasCountrySelected && dismissedCountryHintKey) {
      setDismissedCountryHintKey(null);
    }
  }, [dismissedCountryHintKey, hasCountrySelected]);

  const previewImages = useMemo(() => {
    const mapped = imageUrls.map((url, index) => ({
      id: `preview-${index}`,
      image_url: url,
    }));
    if (!coverImageUrl) return mapped;
    const coverIndex = mapped.findIndex((img) => img.image_url === coverImageUrl);
    if (coverIndex <= 0) return mapped;
    const cover = mapped[coverIndex];
    const rest = mapped.filter((_, idx) => idx !== coverIndex);
    return [cover, ...rest];
  }, [coverImageUrl, imageUrls]);

  const resolveAuthUser = useCallback(async (supabase: ReturnType<typeof createBrowserSupabaseClient>) => {
    if (authResolveRef.current) {
      return authResolveRef.current;
    }

    const resolver = (async () => {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (session?.user) {
        return { user: session.user, accessToken: session.access_token, error: sessionError };
      }

      const {
        data: { session: refreshedSession },
      } = await supabase.auth.refreshSession();

      if (refreshedSession?.user) {
        return {
          user: refreshedSession.user,
          accessToken: refreshedSession.access_token,
          error: sessionError,
        };
      }

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      return {
        user,
        accessToken: refreshedSession?.access_token ?? session?.access_token ?? null,
        error: sessionError || userError,
      };
    })();

    authResolveRef.current = resolver;
    try {
      return await resolver;
    } finally {
      authResolveRef.current = null;
    }
  }, []);

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
      setErrorCode(null);
      return null;
    }
    return createBrowserSupabaseClient();
  }, [setError]);

  const handleVideoUpload = useCallback(
    async (file: File) => {
      if (!propertyId) {
        setVideoError("Save the listing before uploading video.");
        return;
      }
      if (!isAllowedVideoType(file.type)) {
        setVideoError("Upload an MP4 (or MOV).");
        return;
      }
      if (!isAllowedVideoSize(file.size)) {
        setVideoError("Video must be 20MB or less.");
        return;
      }
      const supabase = getSupabase();
      if (!supabase) return;
      const { user, accessToken } = await resolveAuthUser(supabase);
      if (!user) {
        setError("Please log in to upload video.");
        return;
      }
      setVideoUploading(true);
      setVideoError(null);
      try {
        const formData = new FormData();
        formData.append("file", file);
        const res = await fetch(`/api/properties/${propertyId}/video`, {
          method: "POST",
          headers: {
            ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
          },
          body: formData,
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          const message = data?.error || "Video upload failed. Try again.";
          setVideoError(message);
          return;
        }
        setVideoUrl((data as { video_url?: string })?.video_url ?? null);
      } catch (err) {
        setVideoError(err instanceof Error ? err.message : "Video upload failed. Try again.");
      } finally {
        setVideoUploading(false);
        if (videoInputRef.current) {
          videoInputRef.current.value = "";
        }
      }
    },
    [getSupabase, propertyId, resolveAuthUser, setError]
  );

  const handleVideoRemove = useCallback(async () => {
    if (!propertyId) {
      setVideoUrl(null);
      return;
    }
    const supabase = getSupabase();
    if (!supabase) return;
    const { user, accessToken } = await resolveAuthUser(supabase);
    if (!user) {
      setError("Please log in to remove video.");
      return;
    }
    setVideoUploading(true);
    setVideoError(null);
    try {
      const res = await fetch(`/api/properties/${propertyId}/video`, {
        method: "DELETE",
        headers: {
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setVideoError(data?.error || "Unable to remove video.");
        return;
      }
      setVideoUrl(null);
    } catch (err) {
      setVideoError(err instanceof Error ? err.message : "Unable to remove video.");
    } finally {
      setVideoUploading(false);
    }
  }, [getSupabase, propertyId, resolveAuthUser, setError]);

  const persistImageOrder = useCallback(
    async (order: string[]) => {
      if (!propertyId) return;
      const supabase = getSupabase();
      if (!supabase) return;
      const { accessToken, user } = await resolveAuthUser(supabase);
      if (!user) {
        setError("Please log in to save photo order.");
        return;
      }
      const res = await fetch(`/api/properties/${propertyId}/media-order`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({ order }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        const message = data?.error || "Unable to update photo order.";
        setError(message);
      }
    },
    [getSupabase, propertyId, resolveAuthUser]
  );

  const persistCover = useCallback(
    async (cover: string | null) => {
      if (!propertyId) return;
      const supabase = getSupabase();
      if (!supabase) return;
      const { accessToken, user } = await resolveAuthUser(supabase);
      if (!user) {
        setError("Please log in to save cover photo.");
        return;
      }
      const res = await fetch(`/api/properties/${propertyId}/cover`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({ coverImageUrl: cover }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        const message = data?.error || "Unable to update cover photo.";
        setError(message);
      } else {
        lastPersistedCover.current = cover;
      }
    },
    [getSupabase, propertyId, resolveAuthUser]
  );

  const updateImageUrls = useCallback(
    (updater: ((prev: string[]) => string[]) | string[]) => {
      let nextValue: string[] | null = null;
      setImageUrls((prev) => {
        const next = typeof updater === "function" ? updater(prev) : updater;
        nextValue = next;
        return next;
      });
      if (nextValue) {
        syncCoverWithImages(nextValue);
        setImageMeta((prev) => {
          const nextMeta: Record<string, ImageMeta> = {};
          nextValue?.forEach((url) => {
            if (prev[url]) nextMeta[url] = prev[url];
          });
          return nextMeta;
        });
        if (propertyId) {
          void persistImageOrder(nextValue);
        }
      }
    },
    [persistImageOrder, propertyId, syncCoverWithImages]
  );

  const saveDraft = useCallback(async (statusOverride?: PropertyStatus) => {
    if (!canCreateDraft) return;
    setErrorCode(null);
    const supabase = getSupabase();
    if (!supabase) return;

    const { user, accessToken } = await resolveAuthUser(supabase);
    if (!user) {
      setError("Please log in to save a listing.");
      setErrorCode("not_authenticated");
      return;
    }

    const restPayload = { ...payload } as FormState;
    delete restPayload.status;
    delete restPayload.is_active;
    const status = statusOverride || (payload.status as PropertyStatus) || "draft";
    const shouldIncludeStatus =
      !propertyId || !!statusOverride || status === "draft" || status === "paused";
    const requestBody = {
      ...restPayload,
      imageUrls,
      cover_image_url: coverImageUrl ?? null,
      imageMeta,
      ...(shouldIncludeStatus
        ? { status, is_active: status === "pending" || status === "live" }
        : {}),
    };

    const requestKey = JSON.stringify(requestBody);
    if (!statusOverride && requestKey === lastAutoSaved.current) {
      return;
    }

    markSaving(() => saveDraft(statusOverride));
    const url = propertyId ? `/api/properties/${propertyId}` : "/api/properties";
    const method = propertyId ? "PUT" : "POST";

    try {
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
        type ApiError = {
          code?: string;
          maxListings?: number;
          error?: string;
          fieldErrors?: Record<string, string>;
        };
        let data: ApiError | null = null;
        try {
          data = raw ? (JSON.parse(raw) as ApiError) : null;
        } catch {
          data = null;
        }
        const validationErrors =
          data && typeof data.fieldErrors === "object" && data.fieldErrors !== null
            ? (data.fieldErrors as Record<string, string>)
            : null;
        if (validationErrors) {
          setFieldErrors(validationErrors);
          const firstKey = Object.keys(validationErrors)[0];
          if (firstKey) {
            scrollToField(firstKey);
          }
        }
        if (data?.code === "plan_limit_reached") {
          const limitMessage =
            typeof data?.maxListings === "number"
              ? ` Plan limit: ${data.maxListings}.`
              : "";
          setErrorCode(data.code);
          throw new Error(`Plan limit reached.${limitMessage} Upgrade to add more listings.`);
        }
        if (data?.code === "LOCATION_PIN_REQUIRED") {
          setLocationPublishError(true);
          setErrorCode(data.code);
          const message = data?.error || "Pin your listing location to publish.";
          if (locationSectionRef.current) {
            locationSectionRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
            const focusable =
              locationSectionRef.current.querySelector("input,textarea,button") ?? null;
            (focusable as HTMLElement | null)?.focus();
          }
          throw new Error(message);
        }
        if (typeof data?.code === "string") {
          setErrorCode(data.code);
        } else {
          setErrorCode(null);
        }
        const fallbackMessage = validationErrors
          ? "Please correct the highlighted fields."
          : data?.error || raw || "Unable to save draft.";
        throw new Error(fallbackMessage);
      }

      setFieldErrors({});

      if (!propertyId) {
        const json = await res.json().catch(() => ({}));
        if (json?.id) {
          setPropertyId(json.id);
        }
      }

      lastAutoSaved.current = requestKey;
      setDraftNotice(status === "draft" ? "Draft saved." : null);
      markSaved();
    } catch (err) {
      markSaveError(() => saveDraft(statusOverride));
      throw err;
    }
  }, [
    canCreateDraft,
    getSupabase,
    imageUrls,
    coverImageUrl,
    imageMeta,
    payload,
    propertyId,
    resolveAuthUser,
    markSaveError,
    markSaved,
    markSaving,
    setDraftNotice,
    setError,
  ]);

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

  useEffect(() => {
    if (!coverImageUrl) {
      setCoverWarning({ tooSmall: false, portrait: false, unknown: true });
      return;
    }
    const meta = imageMeta[coverImageUrl];
    const classification = classifyCoverHint(meta);
    if (!classification.unknown) {
      setCoverWarning(classification);
      return;
    }
    const img = new Image();
    img.onload = () => {
      const computedMeta: ImageMeta = {
        width: img.naturalWidth,
        height: img.naturalHeight,
      };
      setImageMeta((prev) => ({ ...prev, [coverImageUrl]: computedMeta }));
      setCoverWarning(classifyCoverHint(computedMeta));
    };
    img.onerror = () => setCoverWarning({ tooSmall: false, portrait: false, unknown: false });
    img.src = coverImageUrl;
  }, [coverImageUrl, imageMeta]);

  useEffect(() => {
    setPrepublishDismissed(false);
  }, [propertyId]);

  useEffect(() => {
    setReviewDismissed(false);
  }, [propertyId]);

  useEffect(() => {
    if (hasAppliedInitialFocus.current) return;
    if (resolvedInitialFocus === "location" && locationSectionRef.current) {
      hasAppliedInitialFocus.current = true;
      const section = locationSectionRef.current;
      section.scrollIntoView({ behavior: "smooth", block: "start" });
      const searchEl =
        locationSearchInputRef.current ||
        (section.querySelector("input,textarea,select,button") as HTMLElement | null);
      if (searchEl) {
        window.setTimeout(() => {
          searchEl.focus({ preventScroll: true });
        }, 50);
      }
    }
  }, [resolvedInitialFocus]);

  const buildLocalRecommendation = useCallback((): RecommendedSuggestion | null => {
    if (!imageUrls.length) return null;
    const candidates = imageUrls.map((url, index) => ({
      image_url: url,
      position: index,
      created_at: null,
      width: imageMeta[url]?.width ?? null,
      height: imageMeta[url]?.height ?? null,
    }));
    const pick = pickRecommendedCover(candidates, imageUrls);
    if (!pick.url) return null;
    const meta = imageMeta[pick.url];
    const width = meta?.width ?? null;
    const height = meta?.height ?? null;
    const quality = {
      width,
      height,
      meets1600x900:
        typeof width === "number" && typeof height === "number"
          ? width >= 1600 && height >= 900
          : null,
      isPortrait:
        typeof width === "number" && typeof height === "number" ? height > width : null,
    };
    return {
      url: pick.url,
      reason: pick.reason,
      isAlreadyCover: pick.url === coverImageUrl,
      quality,
      source: "local",
    };
  }, [coverImageUrl, imageMeta, imageUrls]);

  useEffect(() => {
    setRecommendedDismissed(false);
    if (!imageUrls.length) {
      setRecommended(null);
      return;
    }
    if (!propertyId) {
      setRecommended(buildLocalRecommendation());
      return;
    }
    const supabase = getSupabase();
    if (!supabase) {
      setRecommended(buildLocalRecommendation());
      return;
    }
    void (async () => {
      try {
        const { accessToken, user } = await resolveAuthUser(supabase);
        if (!user) {
          setRecommended(buildLocalRecommendation());
          return;
        }
        const res = await fetch(`/api/properties/${propertyId}/cover/recommended`, {
          headers: {
            ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
          },
        });
        if (!res.ok) {
          setRecommended(buildLocalRecommendation());
          return;
        }
        const json = await res.json();
        if (!json?.recommended) {
          setRecommended(buildLocalRecommendation());
          return;
        }
        const rec = json.recommended as RecommendedSuggestion;
        setRecommended({
          ...rec,
          source: "api",
        });
      } catch {
        setRecommended(buildLocalRecommendation());
      }
    })();
  }, [buildLocalRecommendation, getSupabase, imageUrls, propertyId, resolveAuthUser]);

  useEffect(() => {
    setVideoUrl(initialData?.property_videos?.[0]?.video_url ?? null);
  }, [initialData?.property_videos]);

  const reviewListing = useMemo(() => {
    const images = imageUrls.map((url) => ({
      id: url,
      image_url: url,
      width: imageMeta[url]?.width ?? null,
      height: imageMeta[url]?.height ?? null,
    }));
    return {
      id: propertyId ?? "new",
      cover_image_url: coverImageUrl ?? null,
      recommended_cover_url: recommended?.url ?? undefined,
      images,
      title: form.title || undefined,
      updated_at: initialData?.updated_at ?? undefined,
      created_at: initialData?.created_at ?? undefined,
      country_code: form.country_code || undefined,
      admin_area_1: form.state_region || undefined,
      admin_area_2: form.admin_area_2 || undefined,
      postal_code: form.postal_code || undefined,
      city: form.city || undefined,
      latitude: form.latitude ?? undefined,
      longitude: form.longitude ?? undefined,
      location_label: form.location_label || undefined,
      location_place_id: form.location_place_id || undefined,
    };
  }, [
    coverImageUrl,
    form.admin_area_2,
    form.city,
    form.country_code,
    form.latitude,
    form.location_label,
    form.location_place_id,
    form.longitude,
    form.postal_code,
    form.state_region,
    form.title,
    imageMeta,
    imageUrls,
    initialData?.created_at,
    initialData?.updated_at,
    propertyId,
    recommended?.url,
  ]);

  const reviewChecklist = useMemo(
    () =>
      buildReviewAndPublishChecklist(reviewListing, {
        requireLocationPinForPublish,
      }),
    [reviewListing, requireLocationPinForPublish]
  );

  const lastUpdatedText = useMemo(
    () => formatRelativeTime(initialData?.updated_at ?? initialData?.created_at ?? null),
    [initialData?.created_at, initialData?.updated_at]
  );

  useEffect(() => {
    if (!propertyId) return;
    const current = coverImageUrl ?? null;
    if (lastPersistedCover.current === current) return;
    lastPersistedCover.current = current;
    void persistCover(current);
  }, [coverImageUrl, persistCover, propertyId]);

  const handleChange = useCallback(
    (key: keyof FormState, value: string | number | boolean | null) => {
      setFieldErrors((prev) => {
        if (!(key in prev)) return prev;
        const next = { ...prev };
        delete next[key as string];
        return next;
      });
      if (key === "city" && autoFillHints.city) {
        setAutoFillHints((prev) => ({ ...prev, city: false }));
        setUserEdited((prev) => ({ ...prev, city: true }));
      }
      if (key === "state_region" && autoFillHints.state) {
        setAutoFillHints((prev) => ({ ...prev, state: false }));
        setUserEdited((prev) => ({ ...prev, state_region: true }));
      }
      if (key === "neighbourhood" && autoFillHints.neighbourhood) {
        setAutoFillHints((prev) => ({ ...prev, neighbourhood: false }));
        setUserEdited((prev) => ({ ...prev, neighbourhood: true }));
      }
      if (key === "country" && autoFillHints.country) {
        setAutoFillHints((prev) => ({ ...prev, country: false }));
        setUserEdited((prev) => ({ ...prev, country: true }));
      }
      if (key === "admin_area_2" && autoFillHints.admin_area_2) {
        setAutoFillHints((prev) => ({ ...prev, admin_area_2: false }));
        setUserEdited((prev) => ({ ...prev, admin_area_2: true }));
      }
      if (key === "postal_code" && autoFillHints.postal_code) {
        setAutoFillHints((prev) => ({ ...prev, postal_code: false }));
        setUserEdited((prev) => ({ ...prev, postal_code: true }));
      }
      if (key === "country_code" && autoFillHints.country) {
        setAutoFillHints((prev) => ({ ...prev, country: false }));
        setUserEdited((prev) => ({ ...prev, country: true }));
      }
      if (key === "state_region") {
        setForm((prev) => ({
          ...prev,
          state_region: value as string | null | undefined,
          admin_area_1: typeof value === "string" ? value : prev.admin_area_1,
        }));
        return;
      }
      setForm((prev) => ({ ...prev, [key]: value }));
    },
    [
      autoFillHints.admin_area_2,
      autoFillHints.city,
      autoFillHints.country,
      autoFillHints.neighbourhood,
      autoFillHints.postal_code,
      autoFillHints.state,
    ]
  );

  const handleApplyCountryFromHint = useCallback(() => {
    if (!countryHint.key) return;
    const option =
      (countryHint.countryCode ? getCountryByCode(countryHint.countryCode) : null) ||
      (countryHint.countryName ? getCountryByName(countryHint.countryName) : null);
    if (option) {
      handleChange("country", option.name);
      handleChange("country_code", option.code);
    } else {
      if (countryHint.countryName) handleChange("country", countryHint.countryName);
      if (countryHint.countryCode) handleChange("country_code", countryHint.countryCode);
    }
    setDismissedCountryHintKey(countryHint.key);
    countryButtonRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
    countryButtonRef.current?.focus();
    countryButtonRef.current?.click();
  }, [
    countryHint.countryCode,
    countryHint.countryName,
    countryHint.key,
    handleChange,
  ]);

  const clearPinnedLocation = useCallback(() => {
    handleChange("latitude", null);
    handleChange("longitude", null);
    handleChange("location_label", null);
    handleChange("location_place_id", null);
    handleChange("location_source", null);
    handleChange("location_precision", null);
    setAutoFillHints({});
    setUserEdited((prev) => ({
      ...prev,
      country: false,
      city: false,
      state_region: false,
      neighbourhood: false,
      admin_area_2: false,
      postal_code: false,
    }));
    setLocationQuery("");
  }, [handleChange]);

  const applyLocationResult = useCallback(
    (
      result: {
        label: string;
        place_id: string;
        lat: number;
        lng: number;
        region_name?: string | null;
        district_name?: string | null;
        place_name?: string | null;
        locality_name?: string | null;
        neighborhood_name?: string | null;
        country_code?: string | null;
        country_name?: string | null;
        admin_area_1?: string | null;
        admin_area_2?: string | null;
        locality?: string | null;
        sublocality?: string | null;
        postal_code?: string | null;
      }
    ) => {
      handleChange("latitude", result.lat);
      handleChange("longitude", result.lng);
      handleChange("location_label", result.label);
      handleChange("location_place_id", result.place_id);
      handleChange("location_source", "geocode");
      handleChange("location_precision", "approx");
      setLocationQuery(result.label);
      setLocationResults([]);

      setAutoFillHints((prev) => {
        const next = { ...prev };
        const countryCode = result.country_code ? result.country_code.toUpperCase() : null;
        const countryFromCode = countryCode ? getCountryByCode(countryCode) : null;
        const countryFromName =
          !countryFromCode && result.country_name ? getCountryByName(result.country_name) : null;
        const option = countryFromCode || countryFromName;
        if (option) {
          handleChange("country", option.name);
          handleChange("country_code", option.code);
          next.country = true;
        }
        const shouldFillCity =
          (!form.city || !form.city.trim()) &&
          !userEdited.city &&
          (result.locality || result.place_name || result.locality_name || result.district_name);
        const shouldFillState =
          (!form.state_region || !form.state_region.trim()) &&
          !userEdited.state_region &&
          (result.admin_area_1 || result.region_name || result.district_name);
        const shouldFillAdminArea2 =
          (!form.admin_area_2 || !form.admin_area_2.trim()) &&
          !userEdited.admin_area_2 &&
          (result.admin_area_2 || result.district_name);
        const shouldFillNeighbourhood =
          (!form.neighbourhood || !form.neighbourhood.trim()) &&
          !userEdited.neighbourhood &&
          (result.sublocality ||
            result.neighborhood_name ||
            result.locality_name ||
            (result.place_name && result.place_name !== result.locality));
        const shouldFillPostal =
          (!form.postal_code || !form.postal_code.trim()) && !userEdited.postal_code && !!result.postal_code;

        if (shouldFillCity) {
          handleChange(
            "city",
            result.locality ?? result.place_name ?? result.locality_name ?? result.district_name ?? ""
          );
          next.city = true;
        }
        if (shouldFillState) {
          handleChange(
            "state_region",
            result.admin_area_1 ?? result.region_name ?? result.district_name ?? ""
          );
          next.state = true;
        }
        if (shouldFillAdminArea2) {
          handleChange("admin_area_2", result.admin_area_2 ?? result.district_name ?? "");
          next.admin_area_2 = true;
        }
        if (shouldFillNeighbourhood) {
          handleChange(
            "neighbourhood",
            result.sublocality ??
              result.neighborhood_name ??
              (result.locality_name && result.locality_name !== result.locality
                ? result.locality_name
                : null) ??
              result.place_name ??
              result.district_name ??
              ""
          );
          next.neighbourhood = true;
        }
        if (shouldFillPostal) {
          const sanitizedPostal = sanitizePostalCode(
            countryCode || form.country_code || null,
            result.postal_code ?? null
          );
          handleChange("postal_code", sanitizedPostal ?? "");
          next.postal_code = true;
        }
        return next;
      });
    },
    [
      handleChange,
      form.admin_area_2,
      form.city,
      form.country_code,
      form.neighbourhood,
      form.postal_code,
      form.state_region,
      userEdited.admin_area_2,
      userEdited.city,
      userEdited.neighbourhood,
      userEdited.postal_code,
      userEdited.state_region,
    ]
  );

  const highlightMatch = useCallback(
    (text: string) => {
      const query = locationQuery.trim();
      if (!query) return text;
      const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(`(${escaped})`, "ig");
      return text.split(regex).map((part, idx) =>
        part.toLowerCase() === query.toLowerCase() ? (
          <strong key={`${part}-${idx}`} className="text-slate-900">
            {part}
          </strong>
        ) : (
          <span key={`${part}-${idx}`}>{part}</span>
        )
      );
    },
    [locationQuery]
  );

  const formatBucketLabel = (bucket: string | null | undefined) => {
    switch (bucket) {
      case "onsite":
        return "On-site";
      case "near":
        return "Nearby";
      case "far":
        return "Far";
      default:
        return "Unknown";
    }
  };

  const handleCheckIn = useCallback(() => {
    if (!propertyId) {
      setCheckinMessage("Add a pinned area first to enable check-in.");
      return;
    }
    if (!form.latitude || !form.longitude) {
      setCheckinMessage("Add a pinned area first to enable check-in.");
      return;
    }
    const supabase = getSupabase();
    if (!supabase) return;
    if (!navigator.geolocation) {
      setCheckinMessage("Location permission is required to check in.");
      return;
    }
    setCheckinLoading(true);
    setCheckinMessage(null);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { accessToken, user } = await resolveAuthUser(supabase);
          if (!user) {
            setCheckinMessage("Please log in to check in.");
            return;
          }
          const res = await fetch(`/api/properties/${propertyId}/check-in`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
            },
            body: JSON.stringify({
              lat: position.coords.latitude,
              lng: position.coords.longitude,
              accuracy_m: position.coords.accuracy,
            }),
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) {
            if (data?.code === "pin_required") {
              setCheckinMessage("Add a pinned area first to enable check-in.");
            } else if (res.status === 401 || res.status === 403) {
              setCheckinMessage("Please log in to check in.");
            } else {
              setCheckinMessage("Couldn’t record check-in. Try again.");
            }
            return;
          }
          setCheckinInfo({
            bucket: data?.bucket ?? null,
            checkedInAt: data?.checkedInAt ?? new Date().toISOString(),
          });
          setCheckinMessage("Check-in recorded.");
        } catch {
          setCheckinMessage("Couldn’t record check-in. Try again.");
        } finally {
          setCheckinLoading(false);
        }
      },
      () => {
        setCheckinMessage("Location permission is required to check in.");
        setCheckinLoading(false);
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 }
    );
  }, [form.latitude, form.longitude, getSupabase, propertyId, resolveAuthUser]);

  const handleImproveLocation = useCallback(() => {
    const searchEl = locationSearchInputRef.current;
    if (searchEl) {
      searchEl.scrollIntoView({ behavior: "smooth", block: "center" });
      searchEl.focus();
      return;
    }
    if (locationSectionRef.current) {
      locationSectionRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
      const focusable = locationSectionRef.current.querySelector("input,textarea,button");
      (focusable as HTMLElement | null)?.focus();
    }
  }, []);

  const handleNudgeAction = useCallback(
    (action: PrePublishNudgeAction) => {
      if (action === "location") {
        setStepIndex(0);
        window.setTimeout(() => {
          handleImproveLocation();
        }, 250);
        return;
      }
      if (action === "photos") {
        setStepIndex(2);
        window.setTimeout(() => {
          const el = document.getElementById("photos-step");
          if (el) {
            el.scrollIntoView({ behavior: "smooth", block: "start" });
            const focusable = el.querySelector("input,button,select") as HTMLElement | null;
            focusable?.focus();
          } else {
            window.scrollTo({ top: 0, behavior: "smooth" });
          }
        }, 250);
      }
    },
    [handleImproveLocation]
  );

  const handleReviewFix = useCallback(
    (target: ReviewActionTarget) => {
      if (target.step === "photos") {
        setStepIndex(2);
        if (propertyId) {
          router.push(buildEditorUrl(propertyId, undefined, { step: "photos" }));
        }
        return;
      }
      if (target.focus === "location") {
        setStepIndex(0);
        handleImproveLocation();
        if (propertyId) {
          router.push(buildEditorUrl(propertyId, undefined, { focus: "location" }));
        }
      }
    },
    [handleImproveLocation, propertyId, router]
  );

  const scrollToField = (key: string) => {
    const el = document.getElementById(`field-${key}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      const input = el.querySelector("input,select,textarea") as HTMLElement | null;
      input?.focus();
    }
  };

  const next = () => {
    setError(null);
    if (stepIndex === 0 && !canCreateDraft) {
      const required: Array<keyof FormState> = [
        "title",
        "city",
        "rental_type",
        "price",
        "currency",
        "bedrooms",
        "bathrooms",
      ];
      const missing: Record<string, string> = {};
      required.forEach((key) => {
        const val = form[key];
        const isMissing =
          val === null ||
          typeof val === "undefined" ||
          (typeof val === "string" && !val.trim());
        if (isMissing) missing[key] = `${labelForField(key)} is required`;
      });
      if (Object.keys(missing).length) {
        setFieldErrors(missing);
        const firstKey = Object.keys(missing)[0];
        if (firstKey) {
          scrollToField(firstKey);
        }
      }
      setError("Fix these to continue.");
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

  const handleAiDescription = async () => {
    if (!form.title || !form.city) {
      setError("Add a title and city before generating a description.");
      return;
    }
    setError(null);
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
          price: form.price ?? 0,
          currency: form.currency || "USD",
          bedrooms: form.bedrooms ?? 0,
          bathrooms: form.bathrooms ?? 0,
          furnished: !!form.furnished,
          amenities: form.amenitiesText
            ?.split(",")
            .map((item) => item.trim())
            .filter(Boolean),
          maxGuests: form.max_guests,
          nearbyLandmarks: [],
        }),
      });

      const requestId =
        response.headers.get("x-request-id") || response.headers.get("x-vercel-id");
      const data = await response.json();
      if (!response.ok) {
        const message = data?.error || "Unable to generate description.";
        const suffix = requestId ? ` • ${requestId}` : "";
        setError(`AI generation failed (${response.status})${suffix}: ${message}`);
        return;
      }
      if (!data?.description) {
        const suffix = requestId ? ` • ${requestId}` : "";
        setError(`AI returned no description${suffix}.`);
        return;
      }
      setForm((prev) => ({ ...prev, description: data.description }));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to generate description.";
      setError(message);
    } finally {
      setAiLoading(false);
    }
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

    const { user } = await resolveAuthUser(supabase);
    if (!user) {
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
    let metas: ImageMeta[] = [];
    try {
      metas = await Promise.all(files.map((file) => readImageMetaFromFile(file)));
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
        const url = publicUrl.publicUrl;
        uploaded.push(url);
        const meta = metas[i];
        if (meta) {
          setImageMeta((prev) => ({ ...prev, [url]: meta }));
        }
        setUploadProgress(Math.round(((i + 1) / files.length) * 100));
      }
      setFiles([]);
      const nextUrls = [...imageUrls, ...uploaded];
      updateImageUrls(nextUrls);
      await saveDraft();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to upload photos.");
    } finally {
      setUploading(false);
    }
  };

  const applyRecommended = async () => {
    if (!recommended?.url) return;
    setCoverImageUrl(recommended.url);
    setRecommendedDismissed(true);
    setDraftNotice(propertyId ? "Cover updated" : "Cover set for this listing");
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
    setLocationPublishError(false);
    markSubmitting();
    startSaving(() => {
      saveDraft("pending")
        .then(() => {
          markSubmitted();
          const params = new URLSearchParams();
          setToastQuery(params, "Listing submitted for approval", "success");
          router.push(`/dashboard?${params.toString()}`);
        })
        .catch((err) => {
          markSaveError(() => handleSubmitForApproval());
          setError(err instanceof Error ? err.message : "Unable to submit listing.");
        });
    });
  };

  const stepLabel = steps[stepIndex]?.label || "Basics";
  const maxYearBuilt = new Date().getFullYear() + 1;
  const showErrorDetails = process.env.NODE_ENV === "development";
  const hasFieldErrors = Object.keys(fieldErrors).length > 0;
  const resolveStepperError = (message: string, code: string | null) => {
    if (hasFieldErrors) {
      return "Please correct the highlighted fields.";
    }
    if (code === "not_authenticated") {
      return "Please log in to continue.";
    }
    if (code === "role_not_allowed") {
      return "Your role can’t create listings.";
    }
    if (code === "plan_limit_reached") {
      return message;
    }
    if (code === "LOCATION_PIN_REQUIRED") {
      return "Pin your listing location to publish.";
    }
    const normalized = message.toLowerCase();
    if (normalized.includes("supabase environment variables are missing")) {
      return "Listing saves are unavailable right now. Please contact support.";
    }
    if (normalized.includes("storage bucket is not configured")) {
      return "Photo uploads are unavailable right now.";
    }
    return message;
  };
  const errorSummary = error ? resolveStepperError(error, errorCode) : null;
  const errorDetails =
    error && showErrorDetails && errorSummary !== error ? error : null;
  const renderFieldError = (key: keyof FormState) =>
    fieldErrors[key as string] ? (
      <p className="text-xs text-rose-600">{fieldErrors[key as string]}</p>
    ) : null;
  const hasFieldErrorsCurrent = Object.keys(currentFieldErrors).length > 0;
  const hasAnyFieldErrors = Object.keys(fieldErrors).length > 0;
  const shouldShowErrorSummary =
    !!errorSummary && (hasFieldErrorsCurrent || !hasAnyFieldErrors);

  return (
    <div className="space-y-8">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
              Step {stepIndex + 1} of {steps.length}
            </p>
            <h2 className="text-lg font-semibold text-slate-900">{stepLabel}</h2>
          </div>
          {draftNotice && <p className="text-xs text-emerald-600">{draftNotice}</p>}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 text-[11px] sm:grid-cols-5 sm:text-xs">
          {steps.map((step, index) => {
            const isActive = index === stepIndex;
            const isComplete = index < stepIndex;
            return (
              <div
                key={step.id}
                aria-current={isActive ? "step" : undefined}
                className={`rounded-full px-3 py-1.5 text-center font-semibold uppercase tracking-wide transition ${
                  isActive
                    ? "bg-sky-600 text-white"
                    : isComplete
                      ? "bg-sky-100 text-sky-700"
                      : "bg-slate-100 text-slate-500"
                }`}
              >
                {step.label}
              </div>
            );
          })}
        </div>
      </div>

      <div className="min-h-[1.5rem]">
        {shouldShowErrorSummary && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            <p className="font-semibold">Fix these to continue</p>
            <ul className="mt-1 list-disc pl-4">
              {hasFieldErrorsCurrent
                ? Object.keys(currentFieldErrors).map((key) => (
                    <li key={key}>
                      <button
                        type="button"
                        className="underline"
                        onClick={() => {
                          const el = document.getElementById(`field-${key}`);
                          if (el) {
                            el.scrollIntoView({ behavior: "smooth", block: "center" });
                            const input = el.querySelector("input,select,textarea") as HTMLElement | null;
                            input?.focus();
                          }
                        }}
                      >
                        {labelForField(key)}
                      </button>
                    </li>
                  ))
                : (
                  <li>{errorSummary}</li>
                )}
            </ul>
            <div className="mt-2 flex flex-wrap gap-3">
              {errorCode === "not_authenticated" && (
                <Link href="/auth/login" className="text-sm font-semibold underline">
                  Log in
                </Link>
              )}
              {errorCode === "role_not_allowed" && (
                <Link href="/properties" className="text-sm font-semibold underline">
                  Browse listings
                </Link>
              )}
              {errorCode === "LOCATION_PIN_REQUIRED" && (
                <button
                  type="button"
                  className="text-sm font-semibold underline"
                  onClick={() => {
                    locationSectionRef.current?.scrollIntoView({
                      behavior: "smooth",
                      block: "center",
                    });
                    const focusable =
                      locationSectionRef.current?.querySelector("input,textarea,button") ?? null;
                    (focusable as HTMLElement | null)?.focus();
                  }}
                >
                  Go to location
                </button>
              )}
            </div>
            {errorDetails && (
              <p className="mt-2 text-xs text-rose-700/80">
                Details: {errorDetails}
              </p>
            )}
          </div>
        )}
      </div>

      {stepIndex === 0 && (
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-6">
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">Basics</h3>
                  <p className="text-xs text-slate-500">
                    Core details that appear in search and cards.
                  </p>
                </div>
              </div>
              <div className="mt-4 grid gap-4">
                <div className="space-y-2" id="field-title">
                  <label htmlFor="listing-title" className="text-sm font-medium text-slate-700">
                    Listing title <span className="text-rose-500">*</span>
                  </label>
                  <Input
                    id="listing-title"
                    required
                    aria-required="true"
                    value={form.title || ""}
                    onChange={(e) => handleChange("title", e.target.value)}
                    placeholder="e.g. Bright 2-bed in Lekki Phase 1"
                    className={fieldErrors.title ? "ring-2 ring-rose-400 border-rose-300" : ""}
                  />
                  {renderFieldError("title")}
                </div>
                <div className="space-y-2" id="field-rental_type">
                  <label htmlFor="rental-type" className="text-sm font-medium text-slate-700">
                    Rental type <span className="text-rose-500">*</span>
                  </label>
                  <Select
                    id="rental-type"
                    value={form.rental_type}
                    onChange={(e) => handleChange("rental_type", e.target.value as RentalType)}
                    aria-required="true"
                    className={fieldErrors.rental_type ? "ring-2 ring-rose-400 border-rose-300" : ""}
                  >
                    {rentalTypes.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </Select>
                  {renderFieldError("rental_type")}
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">Location</h3>
                  <p className="text-xs text-slate-500">
                    Used for search relevance and map placement.
                  </p>
                </div>
              </div>
              <div className="mt-4 space-y-4" ref={locationSectionRef}>
                {enableLocationPicker ? (
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-slate-900">
                          {searchCountryName
                            ? `Searching in ${searchCountryName}`
                            : "Searching worldwide (pick a country for better results)"}
                        </p>
                        <p className="text-xs text-slate-600">
                          Country selection improves accuracy and matches nearby your pinned area.
                        </p>
                      </div>
                      <InfoPopover
                        ariaLabel="Why these results?"
                        title="Why these results?"
                        bullets={["We prioritise matches in your selected country and near your pinned area (if set)."]}
                      />
                    </div>
                    <div className="space-y-1">
                      <label htmlFor="location-search" className="text-sm font-medium text-slate-700">
                        {LOCATION_MICROCOPY.search.label}
                      </label>
                      <Input
                        ref={locationSearchInputRef}
                        id="location-search"
                        value={locationQuery}
                        onChange={(e) => {
                          setLocationQuery(e.target.value);
                          setLocationActiveIndex(0);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && locationResults.length > 0) {
                            e.preventDefault();
                            applyLocationResult(locationResults[locationActiveIndex] || locationResults[0]);
                          } else if (e.key === "ArrowDown") {
                            e.preventDefault();
                            setLocationActiveIndex((prev) =>
                              Math.min(prev + 1, Math.max(locationResults.length - 1, 0))
                            );
                          } else if (e.key === "ArrowUp") {
                            e.preventDefault();
                            setLocationActiveIndex((prev) => Math.max(prev - 1, 0));
                          }
                        }}
                        placeholder={LOCATION_MICROCOPY.search.placeholder}
                      />
                      <p className="text-xs text-slate-500">{LOCATION_MICROCOPY.search.helper1}</p>
                      <p className="text-xs text-slate-500">{LOCATION_MICROCOPY.search.helper2}</p>
                    </div>
                    {locationSearching && (
                      <p className="text-xs text-slate-500">{LOCATION_MICROCOPY.search.loading}</p>
                    )}
                    {locationError && (
                      <p className="text-xs text-rose-600 whitespace-pre-line">
                        {locationError}
                      </p>
                    )}
                    {showCountryCta && countryCtaMessage && (
                      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                        <span>{countryCtaMessage}</span>
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          onClick={handleApplyCountryFromHint}
                        >
                          {countryCtaButtonLabel}
                        </Button>
                      </div>
                    )}
                    {!locationError && locationSearched && hasPin && (
                      <div className="rounded-lg border border-sky-100 bg-sky-50 px-3 py-2 text-xs text-sky-800 flex items-center justify-between gap-2">
                        <span>
                          Tip: Your pinned area is influencing results. Clear the pin to search elsewhere.
                        </span>
                        <button
                          type="button"
                          className="text-sky-700 font-semibold"
                          onClick={clearPinnedLocation}
                        >
                          Clear pinned area
                        </button>
                      </div>
                    )}
                    {locationResults.length > 0 && (
                      <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
                        <ul className="divide-y divide-slate-200">
                          {locationResults.map((result, idx) => {
                            const subtitle = [
                              result.neighborhood_name || result.locality_name,
                              result.place_name,
                              result.district_name || result.region_name,
                              result.country_name || result.country_code,
                            ]
                              .filter(Boolean)
                              .join(" • ");
                            const isActive = idx === locationActiveIndex;
                            return (
                              <li key={result.place_id}>
                                <button
                                  type="button"
                                  className={`flex w-full items-center justify-between px-3 py-2 text-left transition ${
                                    isActive ? "bg-sky-50" : "hover:bg-slate-50"
                                  }`}
                                  onClick={() => applyLocationResult(result)}
                                >
                                  <div>
                                    <p className="text-sm font-medium text-slate-900">
                                      {highlightMatch(result.label)}
                                    </p>
                                    {subtitle && (
                                      <p className="text-xs text-slate-500">{subtitle}</p>
                                    )}
                                  </div>
                                  <span className="text-xs font-semibold text-sky-700">
                                    {LOCATION_MICROCOPY.search.action}
                                  </span>
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    )}
                    {locationSearched &&
                      locationResults.length === 0 &&
                      !locationSearching &&
                      !locationError && (
                        <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-800 shadow-sm space-y-2">
                          <div>
                            <p className="text-sm font-semibold text-slate-900">No matches found</p>
                            <p className="text-xs text-slate-600">
                              {searchCountryName
                                ? "Try a nearby town/city, or switch country."
                                : "Try adding a country to narrow results, or search for a larger area (city/state)."}
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              onClick={() => {
                                countryButtonRef.current?.scrollIntoView({
                                  behavior: "smooth",
                                  block: "center",
                                });
                                countryButtonRef.current?.focus();
                                countryButtonRef.current?.click();
                              }}
                            >
                              Switch country
                            </Button>
                            {hasPin && (
                              <Button type="button" size="sm" variant="ghost" onClick={clearPinnedLocation}>
                                Clear pinned area
                              </Button>
                            )}
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setLocationQuery("");
                                setLocationResults([]);
                                setLocationSearched(false);
                                locationSearchInputRef.current?.focus();
                              }}
                            >
                              Try a broader search
                            </Button>
                          </div>
                        </div>
                      )}
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                      {hasPinnedLocation({
                        latitude: form.latitude ?? null,
                        longitude: form.longitude ?? null,
                        location_label: form.location_label ?? null,
                        location_place_id: form.location_place_id ?? null,
                      }) ? (
                        <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <div className="space-y-1">
                            <p className="text-sm font-semibold text-slate-900">
                              {LOCATION_MICROCOPY.pinned.title}
                            </p>
                              <p className="text-xs text-slate-600">{form.location_label}</p>
                              {(form.location_source === "geocode" ||
                                form.location_precision === "approx") && (
                                <p className="text-xs text-slate-500">
                                  {LOCATION_MICROCOPY.pinned.secondary}
                                </p>
                              )}
                              <p className="text-xs text-slate-500">
                                {LOCATION_MICROCOPY.pinned.helper}
                              </p>
                            </div>
                            <button
                              type="button"
                              className="text-sm font-semibold text-sky-700"
                              onClick={clearPinnedLocation}
                            >
                              Change
                            </button>
                          </div>
                          {form.latitude && form.longitude ? (
                            <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                              {process.env.NEXT_PUBLIC_MAPBOX_TOKEN ? (
                                (() => {
                                  const staticMapUrl = buildStaticMapUrl({
                                    lat: form.latitude as number,
                                    lng: form.longitude as number,
                                  });
                                  if (!staticMapUrl) {
                                    return (
                                      <div className="flex h-40 items-center justify-center text-xs text-slate-500">
                                        Map preview unavailable
                                      </div>
                                    );
                                  }
                                  return (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                      src={staticMapUrl}
                                      alt="Pinned location map preview"
                                      className="h-40 w-full object-cover"
                                      onError={(e) => {
                                        (e.currentTarget as HTMLImageElement).style.display = "none";
                                        const placeholder = document.createElement("div");
                                        placeholder.className =
                                          "flex h-40 w-full items-center justify-center text-xs text-slate-500";
                                        placeholder.innerText = "Map preview unavailable";
                                        e.currentTarget.parentElement?.appendChild(placeholder);
                                      }}
                                    />
                                  );
                                })()
                              ) : (
                                <div className="flex h-40 items-center justify-center text-xs text-slate-500">
                                  {LOCATION_MICROCOPY.pinned.mapMissing}
                                </div>
                              )}
                            </div>
                          ) : (
                            <p className="text-xs text-slate-500">
                              Pin set. Map preview will appear when coordinates are available.
                            </p>
                          )}
                        </div>
                      ) : (
                        <p className="text-xs text-slate-600">{LOCATION_MICROCOPY.pinned.noPin}</p>
                      )}
                    {locationPublishError && (
                      <p className="mt-2 text-xs font-semibold text-rose-600">
                        Location is required to publish.
                      </p>
                    )}
                    </div>
                  </div>
                ) : null}

                <LocationQualityCard
                  quality={locationQuality.quality}
                  missing={locationQuality.missing}
                  onImproveLocation={handleImproveLocation}
                />

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2" id="field-country">
                    <label htmlFor="country" className="text-sm font-medium text-slate-700">
                      Country <span className="text-rose-500">*</span>
                    </label>
                    <CountrySelect
                      id="country"
                      buttonRef={countryButtonRef}
                      value={{
                        code: form.country_code ?? null,
                        name: form.country ?? null,
                      }}
                      onChange={(option) => {
                        handleChange("country", option.name);
                        handleChange("country_code", option.code);
                      }}
                      placeholder="Search countries"
                    />
                    {autoFillHints.country && (
                      <p className="text-xs text-slate-500">
                        {LOCATION_MICROCOPY.fields.countryDerived}
                      </p>
                    )}
                    {renderFieldError("country")}
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="state-region" className="text-sm font-medium text-slate-700">
                      State / Region / Province
                    </label>
                    <Input
                      id="state-region"
                      value={form.state_region || ""}
                      onChange={(e) => handleChange("state_region", e.target.value)}
                      placeholder="Lagos State"
                    />
                    {autoFillHints.state && (
                      <p className="text-xs text-slate-500">{LOCATION_MICROCOPY.fields.derived}</p>
                    )}
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2" id="field-city">
                    <label htmlFor="city" className="text-sm font-medium text-slate-700">
                      City / Town <span className="text-rose-500">*</span>
                    </label>
                    <Input
                      id="city"
                      required
                      value={form.city || ""}
                      onChange={(e) => handleChange("city", e.target.value)}
                      placeholder="Lagos, Nairobi, Accra..."
                      aria-required="true"
                      className={fieldErrors.city ? "ring-2 ring-rose-400 border-rose-300" : ""}
                    />
                    {autoFillHints.city && (
                      <p className="text-xs text-slate-500">{LOCATION_MICROCOPY.fields.derived}</p>
                    )}
                    {renderFieldError("city")}
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="neighbourhood" className="text-sm font-medium text-slate-700">
                      Neighbourhood / Area (optional)
                    </label>
                    <Input
                      id="neighbourhood"
                      value={form.neighbourhood || ""}
                      onChange={(e) => handleChange("neighbourhood", e.target.value)}
                      placeholder="Lekki Phase 1"
                    />
                    {autoFillHints.neighbourhood && (
                      <p className="text-xs text-slate-500">{LOCATION_MICROCOPY.fields.derived}</p>
                    )}
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label htmlFor="admin-area-2" className="text-sm font-medium text-slate-700">
                      County / District / LGA (optional)
                    </label>
                    <Input
                      id="admin-area-2"
                      value={form.admin_area_2 || ""}
                      onChange={(e) => handleChange("admin_area_2", e.target.value)}
                      placeholder="Staffordshire, Los Angeles County"
                    />
                    {autoFillHints.admin_area_2 && (
                      <p className="text-xs text-slate-500">{LOCATION_MICROCOPY.fields.derived}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="postal-code" className="text-sm font-medium text-slate-700">
                      Postal code (optional)
                    </label>
                    <Input
                      id="postal-code"
                      value={form.postal_code || ""}
                      onChange={(e) => handleChange("postal_code", e.target.value)}
                      placeholder="ST4 7QB, 101233"
                    />
                    {autoFillHints.postal_code && (
                      <p className="text-xs text-slate-500">{LOCATION_MICROCOPY.fields.derived}</p>
                    )}
                  </div>
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
                  <p className="text-xs text-slate-500">{LOCATION_MICROCOPY.address.helper}</p>
                </div>
                {propertyId && enableLocationPicker && (
                  <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          Check in at this property
                        </p>
                        <p className="text-xs text-slate-600">
                          Records a privacy-safe signal. We don&apos;t store GPS coordinates.
                        </p>
                      </div>
                      <Button
                        size="sm"
                        disabled={
                          checkinLoading || !form.latitude || !form.longitude || !propertyId
                        }
                        onClick={handleCheckIn}
                      >
                        {checkinLoading ? "Checking..." : "Check in now"}
                      </Button>
                    </div>
                    {!form.latitude || !form.longitude ? (
                      <p className="mt-2 text-xs text-amber-700">
                        Add a pinned area first to enable check-in.
                      </p>
                    ) : (
                      <div className="mt-2 space-y-1 text-xs text-slate-700">
                        {checkinInfo ? (
                          <p className="font-semibold">
                            Check-in recorded: {formatBucketLabel(checkinInfo.bucket)}
                            {checkinInfo.checkedInAt
                              ? ` • ${new Date(checkinInfo.checkedInAt).toLocaleString()}`
                              : ""}
                          </p>
                        ) : (
                          <p className="text-slate-600">No check-ins yet.</p>
                        )}
                        {checkinMessage && (
                          <p className="text-rose-600">{checkinMessage}</p>
                        )}
                        <details className="pt-1">
                          <summary className="cursor-pointer text-sky-700">
                            Learn what this does
                          </summary>
                          <p className="pt-1 text-slate-600">
                            We compare your current location to the pinned area and store only a
                            distance bucket (on-site, nearby, or far). No GPS coordinates are kept.
                          </p>
                        </details>
                      </div>
                    )}
                  </div>
                )}
                <div className="space-y-1">
                  <label htmlFor="location-label" className="text-sm font-medium text-slate-700">
                    Location label (shown to tenants as area)
                  </label>
                  <Input
                    id="location-label"
                    value={form.location_label || ""}
                    onChange={(e) => handleChange("location_label", e.target.value)}
                    placeholder="e.g. Wuse Zone 2, Abuja"
                  />
                </div>
                {enableLocationPicker ? (
                  <>
                    <button
                      type="button"
                      className="text-sm font-semibold text-sky-700"
                      onClick={() => setShowAdvancedLocation((prev) => !prev)}
                    >
                      {showAdvancedLocation ? "Hide advanced coordinates" : LOCATION_MICROCOPY.advanced.toggle}
                    </button>
                    {showAdvancedLocation && (
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <label htmlFor="latitude" className="text-sm font-medium text-slate-700">
                              Latitude
                            </label>
                            <InfoPopover
                              ariaLabel="Latitude and longitude help"
                              title={COORDINATES_HELP.title}
                              bullets={COORDINATES_HELP.bullets}
                            />
                          </div>
                          <Input
                            id="latitude"
                            type="number"
                            step="0.000001"
                            value={form.latitude ?? ""}
                            onChange={(e) => {
                              const val = e.target.value;
                              handleChange("latitude", val === "" ? null : Number(val));
                              handleChange("location_source", "manual");
                              handleChange("location_precision", "approx");
                            }}
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
                            onChange={(e) => {
                              const val = e.target.value;
                              handleChange("longitude", val === "" ? null : Number(val));
                              handleChange("location_source", "manual");
                              handleChange("location_precision", "approx");
                            }}
                            placeholder="3.3792"
                          />
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                      Location search isn&apos;t configured yet. You can still enter the details below
                      or add coordinates manually.
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <label htmlFor="latitude" className="text-sm font-medium text-slate-700">
                            Latitude
                          </label>
                          <InfoPopover
                            ariaLabel="Latitude and longitude help"
                            title={COORDINATES_HELP.title}
                            bullets={COORDINATES_HELP.bullets}
                          />
                        </div>
                        <Input
                          id="latitude"
                          type="number"
                          step="0.000001"
                          value={form.latitude ?? ""}
                          onChange={(e) => {
                            const val = e.target.value;
                            handleChange("latitude", val === "" ? null : Number(val));
                            handleChange("location_source", "manual");
                            handleChange("location_precision", "approx");
                          }}
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
                          onChange={(e) => {
                            const val = e.target.value;
                            handleChange("longitude", val === "" ? null : Number(val));
                            handleChange("location_source", "manual");
                            handleChange("location_precision", "approx");
                          }}
                          placeholder="3.3792"
                        />
                      </div>
                    </div>
                    {locationPublishError && (
                      <p className="text-xs font-semibold text-rose-600">
                        Location is required to publish.
                      </p>
                    )}
                  </>
                )}
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">Capacity</h3>
                  <p className="text-xs text-slate-500">
                    Bedrooms, bathrooms, and guest limits.
                  </p>
                </div>
              </div>
              <div className="mt-4 grid gap-4 sm:grid-cols-3">
                <div className="space-y-2" id="field-bedrooms">
                  <label htmlFor="bedrooms" className="text-sm font-medium text-slate-700">
                    Bedrooms <span className="text-rose-500">*</span>
                  </label>
                  <Input
                    id="bedrooms"
                    type="number"
                    min={0}
                    value={form.bedrooms ?? 0}
                    onChange={(e) => handleChange("bedrooms", Number(e.target.value))}
                    aria-required="true"
                    className={fieldErrors.bedrooms ? "ring-2 ring-rose-400 border-rose-300" : ""}
                  />
                  {renderFieldError("bedrooms")}
                </div>
                <div className="space-y-2" id="field-bathrooms">
                  <label htmlFor="bathrooms" className="text-sm font-medium text-slate-700">
                    Bathrooms <span className="text-rose-500">*</span>
                  </label>
                  <Input
                    id="bathrooms"
                    type="number"
                    min={0}
                    value={form.bathrooms ?? 0}
                    onChange={(e) => handleChange("bathrooms", Number(e.target.value))}
                    aria-required="true"
                    className={fieldErrors.bathrooms ? "ring-2 ring-rose-400 border-rose-300" : ""}
                  />
                  {renderFieldError("bathrooms")}
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
            </section>
          </div>

          <div className="lg:sticky lg:top-6 lg:self-start">
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">
                    Pricing & availability
                  </h3>
                  <p className="text-xs text-slate-500">
                    Set the rent amount, cadence, and move-in details.
                  </p>
                </div>
              </div>
              <div className="mt-4 space-y-4">
                <div className="space-y-2" id="field-price">
                  <label htmlFor="price" className="text-sm font-medium text-slate-700">
                    Price <span className="text-rose-500">*</span>
                  </label>
                  <Input
                    id="price"
                    type="number"
                    min={1}
                    value={form.price ?? ""}
                    onChange={(e) => handleChange("price", Number(e.target.value))}
                    aria-required="true"
                    className={fieldErrors.price ? "ring-2 ring-rose-400 border-rose-300" : ""}
                  />
                  {renderFieldError("price")}
                </div>
                <div className="space-y-2" id="field-currency">
                  <label htmlFor="currency" className="text-sm font-medium text-slate-700">
                    Currency <span className="text-rose-500">*</span>
                  </label>
                  <CurrencySelect
                    id="currency"
                    value={form.currency || "USD"}
                    onChange={(value) => handleChange("currency", value)}
                    placeholder="Search currency codes"
                  />
                  {renderFieldError("currency")}
                </div>
                <div className="space-y-2">
                  <span className="text-sm font-medium text-slate-700">Rent period</span>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300">
                      <input
                        type="radio"
                        name="rent_period"
                        value="monthly"
                        className="h-4 w-4"
                        checked={(form.rent_period ?? "monthly") === "monthly"}
                        onChange={() => handleChange("rent_period", "monthly")}
                      />
                      Monthly
                    </label>
                    <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300">
                      <input
                        type="radio"
                        name="rent_period"
                        value="yearly"
                        className="h-4 w-4"
                        checked={form.rent_period === "yearly"}
                        onChange={() => handleChange("rent_period", "yearly")}
                      />
                      Yearly
                    </label>
                  </div>
                  <p className="text-xs text-slate-500">How often is rent paid?</p>
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
                  <p className="text-xs text-slate-500">Optional if the date is flexible.</p>
                </div>
                <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
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
            </section>
          </div>
        </div>
      )}

      {stepIndex === 1 && (
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-6">
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-slate-900">Property specs</h3>
                <p className="text-xs text-slate-500">
                  Essentials tenants expect at a glance.
                </p>
              </div>
              <div className="mt-4 space-y-3">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label htmlFor="listing-type" className="text-sm font-medium text-slate-700">
                      Listing type
                    </label>
                    <Select
                      id="listing-type"
                      value={form.listing_type ?? ""}
                      onChange={(e) =>
                        handleChange("listing_type", e.target.value || null)
                      }
                    >
                      <option value="">Select type</option>
                      {listingTypes.map((type) => (
                        <option key={type.value} value={type.value}>
                          {type.label}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="bathroom-type" className="text-sm font-medium text-slate-700">
                      Bathroom privacy
                    </label>
                    <Select
                      id="bathroom-type"
                      value={form.bathroom_type ?? ""}
                      onChange={(e) =>
                        handleChange("bathroom_type", e.target.value || null)
                      }
                    >
                      <option value="">Select privacy</option>
                      {bathroomTypes.map((type) => (
                        <option key={type.value} value={type.value}>
                          {type.label}
                        </option>
                      ))}
                    </Select>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    id="pets_allowed"
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300 text-sky-600"
                    checked={!!form.pets_allowed}
                    onChange={(e) => handleChange("pets_allowed", e.target.checked)}
                  />
                  <label htmlFor="pets_allowed" className="text-sm text-slate-700">
                    Pets allowed
                  </label>
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-slate-900">Size & age</h3>
                <p className="text-xs text-slate-500">
                  Optional sizing details for comparison.
                </p>
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <label htmlFor="size-value" className="text-sm font-medium text-slate-700">
                    Size value
                  </label>
                  <Input
                    id="size-value"
                    type="number"
                    min={0}
                    step="0.1"
                    value={form.size_value ?? ""}
                    onChange={(e) =>
                      handleChange(
                        "size_value",
                        e.target.value === "" ? null : Number(e.target.value)
                      )
                    }
                  />
                  {renderFieldError("size_value")}
                </div>
                <div className="space-y-2">
                  <label htmlFor="size-unit" className="text-sm font-medium text-slate-700">
                    Size unit
                  </label>
                  <Select
                    id="size-unit"
                    value={form.size_unit ?? "sqm"}
                    onChange={(e) => handleChange("size_unit", e.target.value as SizeUnit)}
                  >
                    {sizeUnits.map((unit) => (
                      <option key={unit.value} value={unit.value}>
                        {unit.label}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="space-y-2">
                  <label htmlFor="year-built" className="text-sm font-medium text-slate-700">
                    Year built
                  </label>
                  <Input
                    id="year-built"
                    type="number"
                    min={1800}
                    max={maxYearBuilt}
                    value={form.year_built ?? ""}
                    onChange={(e) =>
                      handleChange(
                        "year_built",
                        e.target.value === "" ? null : Number(e.target.value)
                      )
                    }
                  />
                  {renderFieldError("year_built")}
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-slate-900">Deposit & rules</h3>
                <p className="text-xs text-slate-500">
                  Clearly set deposits and included utilities.
                </p>
              </div>
              <div className="mt-4 space-y-3">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label htmlFor="deposit-amount" className="text-sm font-medium text-slate-700">
                      Security deposit
                    </label>
                    <Input
                      id="deposit-amount"
                      type="number"
                    min={0}
                    value={form.deposit_amount ?? ""}
                    onChange={(e) =>
                      handleChange(
                        "deposit_amount",
                        e.target.value === "" ? null : Number(e.target.value)
                      )
                    }
                  />
                  <p className="text-xs text-slate-500">
                    Optional; common is 1–2 months.
                  </p>
                  {renderFieldError("deposit_amount")}
                </div>
                  <div className="space-y-2">
                    <label htmlFor="deposit-currency" className="text-sm font-medium text-slate-700">
                      Deposit currency
                    </label>
                    <CurrencySelect
                      id="deposit-currency"
                      value={form.deposit_currency ?? form.currency ?? "USD"}
                      onChange={(value) => handleChange("deposit_currency", value)}
                      placeholder="Search currency codes"
                    />
                    <p className="text-xs text-slate-500">Defaults to listing currency.</p>
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
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold text-slate-900">
                    Description & features
                  </h3>
                  <p className="text-xs text-slate-500">
                    Add story, highlights, and compliance details.
                  </p>
                </div>
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
              <div className="mt-4 space-y-4">
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
            </section>
          </div>

          <div className="lg:sticky lg:top-6 lg:self-start">
            <section className="rounded-2xl border border-slate-200 bg-slate-50/80 p-5">
              <h3 className="text-sm font-semibold text-slate-900">Detail tips</h3>
              <ul className="mt-3 space-y-2 text-xs text-slate-600">
                <li>Deposit currency defaults to listing currency.</li>
                <li>Size and year built are optional.</li>
                <li>Add rules and utilities tenants should know.</li>
              </ul>
            </section>
          </div>
        </div>
      )}

      {stepIndex === 2 && (
        <div className="space-y-4" id="photos-step">
          <div className="space-y-2">
            <label htmlFor="photo-upload" className="text-sm font-medium text-slate-700">
              Photos (Supabase Storage)
            </label>
            <p className="text-xs text-slate-600">
              Add at least 3 photos. Choose a cover photo — it&apos;s the image shown in search results and your listing preview.
            </p>
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
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-1">
                <p className="text-sm font-semibold text-slate-900">Video (optional)</p>
                <p className="text-xs text-slate-600">
                  Add a short walkthrough. Max 20MB. Supported: MP4 or MOV.
                </p>
                {videoError && (
                  <p className="text-xs font-semibold text-rose-700">{videoError}</p>
                )}
                {videoUploading && !videoError && (
                  <p className="text-xs text-slate-600">Uploading...</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <input
                  ref={videoInputRef}
                  type="file"
                  accept={ALLOWED_VIDEO_TYPES.join(",")}
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleVideoUpload(file);
                  }}
                />
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => videoInputRef.current?.click()}
                  disabled={videoUploading || !propertyId}
                >
                  {videoUrl ? "Replace video" : "Upload video"}
                </Button>
                {videoUrl && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={handleVideoRemove}
                    disabled={videoUploading}
                  >
                    Remove
                  </Button>
                )}
              </div>
            </div>
            {videoUrl ? (
              <div className="mt-3 space-y-2">
                <div className="overflow-hidden rounded-xl border border-slate-200">
                  <video
                    src={videoUrl}
                    controls
                    className="h-56 w-full bg-slate-900 object-contain"
                  />
                </div>
                <p className="text-xs text-slate-600">
                  {`Stored in the \`${VIDEO_BUCKET}\` bucket. Replace to upload a new one.`}
                </p>
              </div>
            ) : (
              <p className="mt-3 text-xs text-slate-600">
                No video uploaded yet. Uploading requires saving the listing first.
              </p>
            )}
          </div>

          {imageUrls.length > 0 && (
            <div className="space-y-3">
              {!recommendedDismissed && (
                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-slate-900">Recommended cover</p>
                      <p className="text-xs text-slate-600">
                        {coverImageUrl
                          ? "We found an image that may perform better than your current cover."
                          : "We picked the image that looks best on listing cards and previews."}
                      </p>
                      {recommended?.reason && (
                        <p className="text-xs text-slate-700">{recommended.reason}</p>
                      )}
                      {recommended?.quality &&
                        recommended.quality.meets1600x900 === false && (
                          <p className="text-xs text-amber-700">
                            Cover images look best at 1600×900 or larger.
                          </p>
                        )}
                      {!recommended?.url && (
                        <p className="text-xs text-slate-600">
                          None of these images meet the recommended cover size. You can still choose
                          one, or upload a higher-resolution photo.
                        </p>
                      )}
                    </div>
                    {recommended?.url ? (
                      <div className="flex items-center gap-3">
                        <div className="relative h-16 w-24 overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                          <NextImage
                            src={recommended.url}
                            alt="Recommended cover preview"
                            fill
                            className="object-cover"
                            sizes="120px"
                          />
                          {recommended?.url && recommended.url === coverImageUrl && (
                            <span className="absolute left-1 top-1 rounded bg-emerald-600 px-2 py-0.5 text-[11px] font-semibold text-white">
                              Cover
                            </span>
                          )}
                        </div>
                        <div className="flex flex-col gap-2">
                          <Button
                            type="button"
                            size="sm"
                            onClick={applyRecommended}
                            disabled={!recommended.url || recommended.url === coverImageUrl}
                            aria-label="Use recommended cover image"
                          >
                            {coverImageUrl ? "Switch to recommended cover" : "Use recommended cover"}
                          </Button>
                          <button
                            type="button"
                            className="text-xs font-semibold text-slate-600 hover:text-slate-900"
                            onClick={() => setRecommendedDismissed(true)}
                          >
                            Dismiss
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3">
                        <Button type="button" size="sm" disabled>
                          Use recommended cover
                        </Button>
                        <button
                          type="button"
                          className="text-xs font-semibold text-slate-600 hover:text-slate-900"
                          onClick={() => setRecommendedDismissed(true)}
                        >
                          Dismiss
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium text-slate-700">Photo gallery</p>
                <p className="text-xs text-slate-500">
                  Drag controls let you reorder; set a cover to choose the thumbnail.
                </p>
              </div>
              {(coverWarning.tooSmall || coverWarning.portrait) && (
                <div className="flex flex-col gap-1 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  <span className="font-semibold">Recommended cover</span>
                  <span>Cover looks best at 1600×900+ (landscape).</span>
                  {coverWarning.portrait && (
                    <span>Landscape covers usually look better in search results.</span>
                  )}
                </div>
              )}
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {imageUrls.map((url, index) => {
                  const meta = imageMeta[url];
                  const hasGps = meta?.exif_has_gps ?? meta?.exif?.hasGps ?? null;
                  const capturedAt = meta?.exif_captured_at ?? meta?.exif?.capturedAt ?? null;
                  const formattedCaptured =
                    capturedAt && !Number.isNaN(Date.parse(capturedAt))
                      ? new Date(capturedAt).toLocaleDateString(undefined, {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })
                      : null;

                  return (
                    <div
                      key={url}
                      className="group relative overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
                    >
                      <div className="relative h-44 w-full">
                        <NextImage
                          src={url}
                          alt={`Listing photo ${index + 1}`}
                          fill
                          sizes="(max-width: 768px) 100vw, 33vw"
                          className="object-cover"
                        />
                      </div>
                      <div className="absolute left-2 top-2 flex gap-2">
                        {coverImageUrl === url ? (
                          <span className="rounded-full bg-emerald-600 px-3 py-1 text-xs font-semibold text-white">
                            Cover
                          </span>
                        ) : recommended?.url === url ? (
                          <>
                            <span className="rounded-full bg-sky-600 px-3 py-1 text-xs font-semibold text-white">
                              Recommended
                            </span>
                            <button
                              type="button"
                              className="rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-slate-900 shadow hover:bg-white"
                              onClick={() => setCoverImageUrl(url)}
                            >
                              Set as cover
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            className="rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-slate-900 shadow hover:bg-white"
                            onClick={() => setCoverImageUrl(url)}
                          >
                            Set as cover
                          </button>
                        )}
                      </div>
                      {(hasGps || formattedCaptured) && (
                        <div className="absolute left-2 bottom-16 flex flex-col gap-1 text-[11px] font-semibold text-white drop-shadow">
                          {hasGps && (
                            <span className="w-fit rounded bg-slate-900/70 px-2 py-0.5">
                              Location data detected
                            </span>
                          )}
                          {formattedCaptured && (
                            <span className="w-fit rounded bg-slate-900/70 px-2 py-0.5">
                              Taken {formattedCaptured}
                            </span>
                          )}
                        </div>
                      )}
                      <div className="absolute right-2 top-2 flex gap-2">
                        <button
                          type="button"
                          className="rounded-full bg-white/90 px-2 py-1 text-[11px] font-semibold text-slate-700 shadow hover:bg-white"
                          onClick={() => updateImageUrls((prev) => moveItem(prev, index, -1))}
                          aria-label="Move photo up"
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          className="rounded-full bg-white/90 px-2 py-1 text-[11px] font-semibold text-slate-700 shadow hover:bg-white"
                          onClick={() => updateImageUrls((prev) => moveItem(prev, index, 1))}
                          aria-label="Move photo down"
                        >
                          ↓
                        </button>
                      </div>
                      <div className="flex items-center justify-between px-3 py-2 text-xs text-slate-700">
                        <span className="truncate">Photo {index + 1}</span>
                        <button
                          type="button"
                          className="text-rose-600 hover:text-rose-800"
                          onClick={() =>
                            updateImageUrls((prev) => prev.filter((item) => item !== url))
                          }
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  );
                })}
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
              listing_type: form.listing_type || null,
              country: form.country || null,
              state_region: form.state_region || null,
              rental_type: form.rental_type || "long_term",
              price: form.price || 0,
              currency: form.currency || "USD",
              rent_period: form.rent_period || "monthly",
              bedrooms: form.bedrooms || 0,
              bathrooms: form.bathrooms || 0,
              bathroom_type: form.bathroom_type || null,
              furnished: !!form.furnished,
              size_value: form.size_value || null,
              size_unit: form.size_unit || null,
              year_built: form.year_built || null,
              deposit_amount: form.deposit_amount || null,
              deposit_currency: form.deposit_currency || null,
              pets_allowed: !!form.pets_allowed,
              amenities:
                payload.amenities && payload.amenities.length ? payload.amenities : null,
              cover_image_url: coverImageUrl ?? null,
              images: previewImages,
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
          {!reviewDismissed && (
            <ReviewAndPublishCard
              checklist={reviewChecklist}
              lastUpdatedLabel={lastUpdatedText}
              onFix={handleReviewFix}
              onDismiss={() => setReviewDismissed(true)}
            />
          )}
          {!prepublishDismissed && prepublishNudges.length > 0 && (
            <PrePublishNudgeCard
              items={prepublishNudges}
              onDismiss={() => setPrepublishDismissed(true)}
              onAction={handleNudgeAction}
            />
          )}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <Button onClick={handleSubmitForApproval} disabled={saving || !propertyId}>
              {saving || saveStatus === "submitting"
                ? SAVE_STATUS_COPY.submitting
                : saveStatus === "submitted"
                  ? SAVE_STATUS_COPY.submitted
                  : "Submit for approval"}
            </Button>
            <SaveStatusPill status={saveStatus} onRetry={retrySave} />
          </div>
        </div>
      )}

      <div className="flex flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Button
          variant="ghost"
          onClick={prev}
          disabled={stepIndex === 0}
          className="w-full sm:w-auto"
        >
          Back
        </Button>
        <Button
          onClick={next}
          disabled={stepIndex >= steps.length - 1 || saving}
          className="w-full sm:w-auto"
        >
          {stepIndex >= steps.length - 1 ? "Done" : "Next"}
        </Button>
        <SaveStatusPill status={saveStatus} onRetry={retrySave} />
      </div>
    </div>
  );
}
