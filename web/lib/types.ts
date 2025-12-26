export type UserRole = "tenant" | "landlord" | "agent" | "admin";

export type RentalType = "short_let" | "long_term";

export interface Profile {
  id: string;
  role: UserRole;
  full_name?: string | null;
  phone?: string | null;
  city?: string | null;
  avatar_url?: string | null;
  business_name?: string | null;
  preferred_contact?: string | null;
  areas_served?: string[] | null;
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
