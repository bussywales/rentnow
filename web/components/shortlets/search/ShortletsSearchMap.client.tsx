"use client";

import { useEffect, useMemo, useRef } from "react";
import L from "leaflet";
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { shouldAutoFitShortletMap } from "@/lib/shortlet/search-ui-state";

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
  marketCountry: string;
  resultHash: string;
  fitRequestKey: string;
  height?: string;
};

const NIGERIA_DEFAULT_CENTER: [number, number] = [9.082, 8.6753];
const DEFAULT_WORLD_CENTER: [number, number] = [0, 0];
const NIGERIA_DEFAULT_ZOOM = 6;
const DEFAULT_SINGLE_PIN_ZOOM = 12;
const MAX_REASONABLE_NIGERIA_SPAN_DEGREES = 8;

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

function fitMapToMarkers(input: {
  map: L.Map;
  markers: Array<[number, number]>;
  marketCountry: string;
}) {
  const { map, markers, marketCountry } = input;
  if (!markers.length) return;
  if (markers.length === 1) {
    map.setView(markers[0], DEFAULT_SINGLE_PIN_ZOOM, { animate: false });
    return;
  }
  const bounds = L.latLngBounds(markers);
  const latSpan = Math.abs(bounds.getNorth() - bounds.getSouth());
  const lngSpan = Math.abs(bounds.getEast() - bounds.getWest());

  const requiresNigeriaFallback =
    marketCountry === "NG" &&
    (latSpan > MAX_REASONABLE_NIGERIA_SPAN_DEGREES || lngSpan > MAX_REASONABLE_NIGERIA_SPAN_DEGREES);

  if (requiresNigeriaFallback) {
    map.setView(NIGERIA_DEFAULT_CENTER, NIGERIA_DEFAULT_ZOOM, { animate: false });
    return;
  }
  map.fitBounds(bounds, { padding: [36, 36], animate: false, maxZoom: 13 });
}

function AutoFitToMarkers({
  markers,
  marketCountry,
  resultHash,
  fitRequestKey,
  hasUserMovedMapRef,
  suppressedBoundsUpdatesRef,
}: {
  markers: Array<[number, number]>;
  marketCountry: string;
  resultHash: string;
  fitRequestKey: string;
  hasUserMovedMapRef: { current: boolean };
  suppressedBoundsUpdatesRef: { current: number };
}) {
  const map = useMap();
  const hasAutoFitOnceRef = useRef(false);
  const lastResultHashRef = useRef<string | null>(null);
  const lastFitRequestKeyRef = useRef<string | null>(null);

  useEffect(() => {
    const raf = requestAnimationFrame(() => map.invalidateSize());
    const timeout = setTimeout(() => map.invalidateSize(), 120);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timeout);
    };
  }, [map, fitRequestKey, markers.length]);

  useEffect(() => {
    const shouldAutoFit = shouldAutoFitShortletMap({
      hasMarkers: markers.length > 0,
      hasAutoFitOnce: hasAutoFitOnceRef.current,
      resultHash,
      lastResultHash: lastResultHashRef.current,
      hasUserMovedMap: hasUserMovedMapRef.current,
      fitRequestKey,
      lastFitRequestKey: lastFitRequestKeyRef.current,
    });

    if (!shouldAutoFit) return;

    suppressedBoundsUpdatesRef.current = 2;
    fitMapToMarkers({ map, markers, marketCountry });

    hasAutoFitOnceRef.current = true;
    lastResultHashRef.current = resultHash;
    lastFitRequestKeyRef.current = fitRequestKey;
    hasUserMovedMapRef.current = false;
  }, [
    fitRequestKey,
    hasUserMovedMapRef,
    map,
    markers,
    marketCountry,
    resultHash,
    suppressedBoundsUpdatesRef,
  ]);

  return null;
}

function ReportBounds({
  onBoundsChanged,
  onUserMovedMap,
  suppressedBoundsUpdatesRef,
}: {
  onBoundsChanged: (bounds: MapBounds) => void;
  onUserMovedMap: () => void;
  suppressedBoundsUpdatesRef: { current: number };
}) {
  const map = useMapEvents({
    dragstart() {
      onUserMovedMap();
    },
    zoomstart(event) {
      const sourceEvent = (event as unknown as { originalEvent?: unknown }).originalEvent;
      if (sourceEvent) onUserMovedMap();
    },
    moveend() {
      if (suppressedBoundsUpdatesRef.current > 0) {
        suppressedBoundsUpdatesRef.current -= 1;
        return;
      }
      onBoundsChanged(resolveBounds(map));
    },
    zoomend() {
      if (suppressedBoundsUpdatesRef.current > 0) {
        suppressedBoundsUpdatesRef.current -= 1;
        return;
      }
      onBoundsChanged(resolveBounds(map));
    },
  });

  useEffect(() => {
    onBoundsChanged(resolveBounds(map));
  }, [map, onBoundsChanged, onUserMovedMap]);

  return null;
}

export function ShortletsSearchMapClient({
  listings,
  selectedListingId,
  onSelectListing,
  onBoundsChanged,
  marketCountry,
  resultHash,
  fitRequestKey,
  height = "min(70vh, 760px)",
}: Props) {
  const hasUserMovedMapRef = useRef(false);
  const suppressedBoundsUpdatesRef = useRef(0);
  const mapListings = listings.filter(
    (listing): listing is MapListing & { latitude: number; longitude: number } =>
      typeof listing.latitude === "number" && typeof listing.longitude === "number"
  );
  const markers = useMemo(
    () => mapListings.map((listing) => [listing.latitude, listing.longitude] as [number, number]),
    [mapListings]
  );

  const defaultCenter: [number, number] =
    marketCountry === "NG" ? NIGERIA_DEFAULT_CENTER : markers[0] ?? DEFAULT_WORLD_CENTER;
  const defaultZoom = marketCountry === "NG" ? NIGERIA_DEFAULT_ZOOM : 2;

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <MapContainer
        center={defaultCenter}
        zoom={defaultZoom}
        style={{ height }}
        className="w-full"
        scrollWheelZoom
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <AutoFitToMarkers
          markers={markers}
          marketCountry={marketCountry}
          resultHash={resultHash}
          fitRequestKey={fitRequestKey}
          hasUserMovedMapRef={hasUserMovedMapRef}
          suppressedBoundsUpdatesRef={suppressedBoundsUpdatesRef}
        />
        <ReportBounds
          onBoundsChanged={onBoundsChanged}
          onUserMovedMap={() => {
            hasUserMovedMapRef.current = true;
          }}
          suppressedBoundsUpdatesRef={suppressedBoundsUpdatesRef}
        />
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
