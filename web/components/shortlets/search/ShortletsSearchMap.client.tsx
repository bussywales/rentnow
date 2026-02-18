"use client";

import { useEffect, useMemo, useRef } from "react";
import L from "leaflet";
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { cn } from "@/components/ui/cn";
import {
  resolveShortletMapMarkerVisualState,
  shouldAutoFitShortletMap,
} from "@/lib/shortlet/search-ui-state";

type MapBounds = {
  north: number;
  south: number;
  east: number;
  west: number;
};

type MapListing = {
  id: string;
  title: string;
  city: string;
  currency: string;
  nightlyPriceMinor: number | null;
  primaryImageUrl: string | null;
  latitude: number | null;
  longitude: number | null;
};

type Props = {
  listings: MapListing[];
  selectedListingId: string | null;
  hoveredListingId: string | null;
  onSelectListing: (listingId: string) => void;
  onHoverListing: (listingId: string | null) => void;
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

function createPricePinIcon(
  label: string,
  mode: "default" | "hovered" | "selected"
): L.DivIcon {
  const selected = mode === "selected";
  const hovered = mode === "hovered";
  const bg = selected ? "#0f172a" : hovered ? "#e0f2fe" : "#ffffff";
  const color = selected ? "#ffffff" : hovered ? "#0369a1" : "#0f172a";
  const border = selected ? "#0f172a" : hovered ? "#0ea5e9" : "#cbd5e1";
  const scale = selected ? 1.08 : hovered ? 1.04 : 1;
  const html = `<span style="display:inline-flex;align-items:center;justify-content:center;border-radius:9999px;border:1px solid ${border};background:${bg};color:${color};font-size:12px;font-weight:700;line-height:1;padding:8px 10px;box-shadow:0 2px 12px rgba(15,23,42,0.18);white-space:nowrap;transform:scale(${scale});">${label}</span>`;
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
  hoveredListingId,
  onSelectListing,
  onHoverListing,
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
  const selectedListing = useMemo(
    () => listings.find((listing) => listing.id === selectedListingId) ?? null,
    [listings, selectedListingId]
  );

  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
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
          const markerState = resolveShortletMapMarkerVisualState({
            listingId: listing.id,
            selectedListingId,
            hoveredListingId,
          });
          const pinIcon = createPricePinIcon(
            formatPinPrice(listing.currency, listing.nightlyPriceMinor),
            markerState.mode
          );
          return (
            <Marker
              key={listing.id}
              position={[listing.latitude, listing.longitude]}
              icon={pinIcon}
              zIndexOffset={markerState.zIndexOffset}
              eventHandlers={{
                click: () => onSelectListing(listing.id),
                mouseover: () => onHoverListing(listing.id),
                mouseout: () => onHoverListing(null),
              }}
              title={listing.title}
            />
          );
        })}
      </MapContainer>
      {selectedListing ? (
        <div className="pointer-events-none absolute bottom-3 left-3 right-3 z-[450] sm:right-auto sm:w-[320px]">
          <div className="pointer-events-auto overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
            <div className="flex items-center gap-3 p-3">
              <div className="h-14 w-20 shrink-0 overflow-hidden rounded-lg bg-slate-100">
                {selectedListing.primaryImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={selectedListing.primaryImageUrl}
                    alt={selectedListing.title}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="h-full w-full bg-slate-200" />
                )}
              </div>
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                  {selectedListing.city}
                </p>
                <p className="line-clamp-1 text-sm font-semibold text-slate-900">{selectedListing.title}</p>
                <p className={cn("text-xs font-semibold text-slate-700")}>
                  {formatPinPrice(selectedListing.currency, selectedListing.nightlyPriceMinor)} / night
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
