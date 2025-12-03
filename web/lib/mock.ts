import type { Property } from "@/lib/types";

export const mockProperties: Property[] = [
  {
    id: "mock-1",
    owner_id: "owner-1",
    title: "Modern 2-Bed in Lekki Phase 1",
    description:
      "Bright 2-bedroom apartment with inverter, balcony, and dedicated parking. Ideal for young professionals seeking quick access to VI and Ikoyi.",
    city: "Lagos",
    neighbourhood: "Lekki Phase 1",
    address: "Freedom Way, Lekki Phase 1",
    latitude: 6.459964,
    longitude: 3.601521,
    rental_type: "long_term",
    price: 450000,
    currency: "NGN",
    bedrooms: 2,
    bathrooms: 2,
    furnished: true,
    amenities: ["wifi", "parking", "security", "inverter"],
    available_from: "2025-01-05",
    max_guests: null,
    is_approved: true,
    is_active: true,
    images: [
      {
        id: "img-1",
        image_url:
          "https://images.unsplash.com/photo-1505691938895-1758d7feb511?auto=format&fit=crop&w=1200&q=80",
      },
    ],
  },
  {
    id: "mock-2",
    owner_id: "owner-2",
    title: "Furnished Short-Let Studio in Nairobi",
    description:
      "Airy studio in Kilimani with high-speed internet, weekly cleaning, and self check-in. Perfect for remote workers and quick stays.",
    city: "Nairobi",
    neighbourhood: "Kilimani",
    address: "Lenana Rd, Kilimani",
    latitude: -1.292066,
    longitude: 36.821945,
    rental_type: "short_let",
    price: 55,
    currency: "USD",
    bedrooms: 1,
    bathrooms: 1,
    furnished: true,
    amenities: ["wifi", "parking", "security", "cleaning"],
    available_from: "2024-12-15",
    max_guests: 2,
    is_approved: true,
    is_active: true,
    images: [
      {
        id: "img-2",
        image_url:
          "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1200&q=80",
      },
    ],
  },
  {
    id: "mock-3",
    owner_id: "owner-3",
    title: "3-Bed Family Home in Accra (East Legon)",
    description:
      "Spacious 3-bed with garden, fitted kitchen, and 2-car parking. Close to schools and shopping at A&C Mall.",
    city: "Accra",
    neighbourhood: "East Legon",
    address: "Adjiringanor Rd, East Legon",
    latitude: 5.631965,
    longitude: -0.174286,
    rental_type: "long_term",
    price: 1200,
    currency: "USD",
    bedrooms: 3,
    bathrooms: 3,
    furnished: false,
    amenities: ["parking", "garden", "security"],
    available_from: "2025-02-01",
    max_guests: null,
    is_approved: true,
    is_active: true,
    images: [
      {
        id: "img-3",
        image_url:
          "https://images.unsplash.com/photo-1505691938895-1758d7feb511?auto=format&fit=crop&w=1200&q=80",
      },
    ],
  },
];
