export type UserRole = "tenant" | "landlord" | "agent" | "admin";

export type RentalType = "short_let" | "long_term";

export type RentPeriod = "monthly" | "yearly";

export type ListingIntent = "rent" | "buy";

export type ListingType =
  | "apartment"
  | "house"
  | "duplex"
  | "bungalow"
  | "studio"
  | "room"
  | "student"
  | "hostel"
  | "shop"
  | "office"
  | "land";

export type SizeUnit = "sqm" | "sqft";

export type BathroomType = "private" | "shared";

export type PropertyStatus =
  | "draft"
  | "pending"
  | "live"
  | "expired"
  | "rejected"
  | "paused"
  | "paused_owner"
  | "paused_occupied"
  | "changes_requested";

export type MessageDeliveryState = "sent" | "delivered" | "read";

export interface Profile {
  id: string;
  role: UserRole | null;
  onboarding_completed?: boolean | null;
  onboarding_completed_at?: string | null;
  last_seen_at?: string | null;
  onboarding_dismissed_at?: string | null;
  agent_storefront_enabled?: boolean | null;
  agent_slug?: string | null;
  agent_bio?: string | null;
  full_name?: string | null;
  display_name?: string | null;
  phone?: string | null;
  city?: string | null;
  country?: string | null;
  country_code?: string | null;
  jurisdiction?: string | null;
  avatar_url?: string | null;
  business_name?: string | null;
  preferred_contact?: string | null;
  areas_served?: string[] | null;
  email_verified?: boolean | null;
  phone_verified?: boolean | null;
  bank_verified?: boolean | null;
  reliability_power?: string | null;
  reliability_water?: string | null;
  reliability_internet?: string | null;
  trust_updated_at?: string | null;
  updated_at?: string | null;
  created_at?: string;
}

export interface PropertyImage {
  id: string;
  image_url: string;
  created_at?: string;
  position?: number | null;
  width?: number | null;
  height?: number | null;
  bytes?: number | null;
  format?: string | null;
  exif_has_gps?: boolean | null;
  exif_captured_at?: string | null;
}

export interface Property {
  id: string;
  owner_id: string;
  title: string;
  description?: string | null;
  city: string;
  timezone?: string | null;
  country?: string | null;
  country_code?: string | null;
  admin_area_1?: string | null;
  admin_area_2?: string | null;
  state_region?: string | null;
  postal_code?: string | null;
  neighbourhood?: string | null;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  location_label?: string | null;
  location_place_id?: string | null;
  location_source?: string | null;
  location_precision?: string | null;
  listing_type?: ListingType | null;
  rental_type: RentalType;
  listing_intent?: ListingIntent | null;
  price: number;
  currency: string;
  rent_period?: RentPeriod | null;
  bedrooms: number;
  bathrooms: number;
  bathroom_type?: BathroomType | null;
  furnished: boolean;
  size_value?: number | null;
  size_unit?: SizeUnit | null;
  year_built?: number | null;
  deposit_amount?: number | null;
  deposit_currency?: string | null;
  pets_allowed?: boolean | null;
  amenities?: string[] | null;
  available_from?: string | null;
  max_guests?: number | null;
  is_approved?: boolean;
  is_active?: boolean;
  status?: PropertyStatus;
  rejection_reason?: string | null;
  submitted_at?: string | null;
  approved_at?: string | null;
  rejected_at?: string | null;
  paused_at?: string | null;
  paused_reason?: string | null;
  reactivated_at?: string | null;
  status_updated_at?: string | null;
  is_featured?: boolean | null;
  featured_rank?: number | null;
  featured_until?: string | null;
  featured_at?: string | null;
  featured_by?: string | null;
  expires_at?: string | null;
  expired_at?: string | null;
  renewed_at?: string | null;
  bills_included?: boolean | null;
  epc_rating?: string | null;
  council_tax_band?: string | null;
  features?: string[] | null;
  cover_image_url?: string | null;
  created_at?: string;
  updated_at?: string;
  images?: PropertyImage[];
  property_videos?: Array<{
    id: string;
    video_url: string;
    storage_path?: string | null;
    bytes?: number | null;
    format?: string | null;
    created_at?: string | null;
    updated_at?: string | null;
  }> | null;
}

export interface Message {
  id: string;
  property_id: string;
  thread_id?: string | null;
  sender_id: string;
  recipient_id: string;
  body: string;
  created_at?: string;
  delivery_state?: MessageDeliveryState;
  sender_role?: UserRole | null;
  read_at?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface ViewingRequest {
  id: string;
  property_id: string;
  tenant_id: string;
  preferred_date: string;
  preferred_time_window?: string | null;
  note?: string | null;
  status: "pending" | "accepted" | "declined" | "cancelled";
  created_at?: string;
}

export interface ParsedSearchFilters {
  city: string | null;
  minPrice: number | null;
  maxPrice: number | null;
  currency: string | null;
  bedrooms: number | null;
  rentalType: RentalType | null;
  furnished: boolean | null;
  amenities: string[];
}

export interface SavedSearch {
  id: string;
  user_id: string;
  name: string;
  query_params: Record<string, unknown>;
  created_at?: string;
  last_notified_at?: string | null;
  last_checked_at?: string | null;
}

export interface AgentDelegation {
  id: string;
  agent_id: string;
  landlord_id: string;
  status: "pending" | "active" | "revoked";
  created_at?: string;
  approved_at?: string | null;
}
