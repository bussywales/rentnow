"use client";

import { useEffect, useMemo } from "react";
import L from "leaflet";
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";

type MapBounds = {
  north: number;
  south: number;
  east: number;
  west: number;
};

type MapListing = {
  id: string;
  title: string;
  currency: string;
  nightlyPriceMinor: number | null;
  latitude: number | null;
  longitude: number | null;
};

type Props = {
  listings: MapListing[];
  selectedListingId: string | null;
  onSelectListing: (listingId: string) => void;
  onBoundsChanged: (bounds: MapBounds) => void;
  height?: string;
};

function formatPinPrice(currency: string, nightlyPriceMinor: number | null): string {
  if (typeof nightlyPriceMinor !== "number" || nightlyPriceMinor <= 0) return "₦—";
  const major = nightlyPriceMinor / 100;
  if (currency === "NGN") {
    return `₦${major.toLocaleString("en-NG", { maximumFractionDigits: 0 })}`;
  }
  try {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: currency || "NGN",
      maximumFractionDigits: 0,
    }).format(major);
  } catch {
    return `₦${major.toLocaleString("en-NG", { maximumFractionDigits: 0 })}`;
  }
}

function createPricePinIcon(label: string, selected: boolean): L.DivIcon {
  const bg = selected ? "#0f172a" : "#ffffff";
  const color = selected ? "#ffffff" : "#0f172a";
  const border = selected ? "#0f172a" : "#cbd5e1";
  const html = `<span style="display:inline-flex;align-items:center;justify-content:center;border-radius:9999px;border:1px solid ${border};background:${bg};color:${color};font-size:12px;font-weight:700;line-height:1;padding:8px 10px;box-shadow:0 2px 12px rgba(15,23,42,0.18);white-space:nowrap;">${label}</span>`;
  return L.divIcon({
    html,
    className: "shortlet-price-pin",
    iconSize: [56, 32],
    iconAnchor: [28, 16],
  });
}

function resolveBounds(map: L.Map): MapBounds {
  const bounds = map.getBounds();
  return {
    north: Number(bounds.getNorth().toFixed(6)),
    south: Number(bounds.getSouth().toFixed(6)),
    east: Number(bounds.getEast().toFixed(6)),
    west: Number(bounds.getWest().toFixed(6)),
  };
}

function FitToMarkers({ markers }: { markers: Array<[number, number]> }) {
  const map = useMap();
  useEffect(() => {
    if (!markers.length) return;
    if (markers.length === 1) {
      map.setView(markers[0], 12, { animate: false });
      return;
    }
    const bounds = L.latLngBounds(markers);
    map.fitBounds(bounds, { padding: [36, 36], animate: false });
  }, [map, markers]);
  return null;
}

function ReportBounds({ onBoundsChanged }: { onBoundsChanged: (bounds: MapBounds) => void }) {
  const map = useMapEvents({
    moveend() {
      onBoundsChanged(resolveBounds(map));
    },
    zoomend() {
      onBoundsChanged(resolveBounds(map));
    },
  });

  useEffect(() => {
    onBoundsChanged(resolveBounds(map));
  }, [map, onBoundsChanged]);

  return null;
}

function PanToSelection({
  listings,
  selectedListingId,
}: {
  listings: MapListing[];
  selectedListingId: string | null;
}) {
  const map = useMap();
  useEffect(() => {
    if (!selectedListingId) return;
    const listing = listings.find((item) => item.id === selectedListingId);
    if (!listing || typeof listing.latitude !== "number" || typeof listing.longitude !== "number") return;
    map.panTo([listing.latitude, listing.longitude], { animate: true, duration: 0.3 });
  }, [listings, map, selectedListingId]);
  return null;
}

export function ShortletsSearchMapClient({
  listings,
  selectedListingId,
  onSelectListing,
  onBoundsChanged,
  height = "min(70vh, 760px)",
}: Props) {
  const mapListings = listings.filter(
    (listing): listing is MapListing & { latitude: number; longitude: number } =>
      typeof listing.latitude === "number" && typeof listing.longitude === "number"
  );
  const markers = useMemo(
    () => mapListings.map((listing) => [listing.latitude, listing.longitude] as [number, number]),
    [mapListings]
  );

  const defaultCenter: [number, number] = markers[0] ?? [9.082, 8.6753];

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <MapContainer
        center={defaultCenter}
        zoom={11}
        style={{ height }}
        className="w-full"
        scrollWheelZoom
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitToMarkers markers={markers} />
        <PanToSelection listings={mapListings} selectedListingId={selectedListingId} />
        <ReportBounds onBoundsChanged={onBoundsChanged} />
        {mapListings.map((listing) => {
          const selected = selectedListingId === listing.id;
          const pinIcon = createPricePinIcon(
            formatPinPrice(listing.currency, listing.nightlyPriceMinor),
            selected
          );
          return (
            <Marker
              key={listing.id}
              position={[listing.latitude, listing.longitude]}
              icon={pinIcon}
              eventHandlers={{
                click: () => onSelectListing(listing.id),
              }}
              title={listing.title}
            />
          );
        })}
      </MapContainer>
    </div>
  );
}

