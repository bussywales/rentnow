export type UserRole = "tenant" | "landlord" | "agent" | "admin";

export type RentalType = "short_let" | "long_term";

export type PropertyStatus = "draft" | "pending" | "live" | "rejected" | "paused";

export type MessageDeliveryState = "sent" | "delivered" | "read";

export interface Profile {
  id: string;
  role: UserRole | null;
  onboarding_completed?: boolean | null;
  onboarding_completed_at?: string | null;
  full_name?: string | null;
  phone?: string | null;
  city?: string | null;
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
  created_at?: string;
}

export interface PropertyImage {
  id: string;
  image_url: string;
  created_at?: string;
}

export interface Property {
  id: string;
  owner_id: string;
  title: string;
  description?: string | null;
  city: string;
  neighbourhood?: string | null;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  rental_type: RentalType;
  price: number;
  currency: string;
  bedrooms: number;
  bathrooms: number;
  furnished: boolean;
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
  bills_included?: boolean | null;
  epc_rating?: string | null;
  council_tax_band?: string | null;
  features?: string[] | null;
  created_at?: string;
  updated_at?: string;
  images?: PropertyImage[];
}

export interface Message {
  id: string;
  property_id: string;
  sender_id: string;
  recipient_id: string;
  body: string;
  created_at?: string;
  delivery_state?: MessageDeliveryState;
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
