"use client";

import { useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import L from "leaflet";
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import { cn } from "@/components/ui/cn";
import {
  resolveShortletMapMarkerVisualState,
  shouldAutoFitShortletMap,
} from "@/lib/shortlet/search-ui-state";
import { shouldSoftPanHoveredMarker } from "@/lib/shortlet/map-list-coupling";
import { isShortletBookableFromPricing, resolveShortletBookabilityCta } from "@/lib/shortlet/pricing";
import {
  retainSelectedShortletMarkerId,
  shouldEnableShortletMapClustering,
} from "@/lib/shortlet/map-clustering";
import {
  createShortletMarkerIconCache,
  formatShortletPinPrice,
  type ShortletMarkerVisualMode,
} from "@/lib/shortlet/map-marker-icons";

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
  pricingMode: "nightly" | "price_on_request";
  bookingMode: "instant" | "request";
  primaryImageUrl: string | null;
  mapPreviewImageUrl?: string | null;
  latitude: number | null;
  longitude: number | null;
  href: string;
};

export function resolveShortletsMapPreviewCtaLabel(input: {
  bookingMode: "instant" | "request";
  nightlyPriceMinor: number | null;
  pricingMode: "nightly" | "price_on_request";
}): "Reserve" | "Request" | "View" {
  const isBookable = isShortletBookableFromPricing({
    nightlyPriceMinor: input.nightlyPriceMinor,
    pricingMode: input.pricingMode,
  });
  return resolveShortletBookabilityCta({
    bookingMode: input.bookingMode,
    isBookable,
  });
}

type Props = {
  listings: MapListing[];
  selectedListingId: string | null;
  hoveredListingId: string | null;
  onSelectListing: (listingId: string) => void;
  onHoverListing: (listingId: string | null) => void;
  onBoundsChanged: (bounds: MapBounds) => void;
  marketCountry: string;
  resultHash: string;
  cameraIntent: "initial" | "idle" | "user_search" | "user_search_area" | "location_change";
  cameraIntentNonce: number;
  fitRequestKey: string;
  resolvedFitRequestKey: string;
  preferredCenter?: [number, number] | null;
  height?: string;
  invalidateNonce?: number;
};

const NIGERIA_DEFAULT_CENTER: [number, number] = [9.082, 8.6753];
const DEFAULT_WORLD_CENTER: [number, number] = [0, 0];
const NIGERIA_DEFAULT_ZOOM = 6;
const DEFAULT_SINGLE_PIN_ZOOM = 12;
const MAX_REASONABLE_NIGERIA_SPAN_DEGREES = 8;

function createPricePinIcon(
  label: string,
  mode: ShortletMarkerVisualMode
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
  cameraIntent,
  cameraIntentNonce,
  fitRequestKey,
  resolvedFitRequestKey,
  suppressBoundsUpdatesRef,
  invalidateNonce,
}: {
  markers: Array<[number, number]>;
  marketCountry: string;
  resultHash: string;
  cameraIntent: "initial" | "idle" | "user_search" | "user_search_area" | "location_change";
  cameraIntentNonce: number;
  fitRequestKey: string;
  resolvedFitRequestKey: string;
  suppressBoundsUpdatesRef: { current: number };
  invalidateNonce?: number;
}) {
  const map = useMap();
  const lastHandledIntentNonceRef = useRef<number>(0);
  const lastFittedResultHashRef = useRef<string | null>(null);

  useEffect(() => {
    const raf = requestAnimationFrame(() => map.invalidateSize());
    const timeout = setTimeout(() => map.invalidateSize(), 120);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timeout);
    };
  }, [invalidateNonce, map, fitRequestKey, markers.length]);

  useEffect(() => {
    if (resolvedFitRequestKey !== fitRequestKey) return;
    if (cameraIntentNonce === lastHandledIntentNonceRef.current) return;

    const shouldAutoFit = shouldAutoFitShortletMap({
      hasMarkers: markers.length > 0,
      cameraIntent,
      cameraIntentNonce,
      resolvedFitRequestKey,
      activeFitRequestKey: fitRequestKey,
      resultHash,
      lastFittedResultHash: lastFittedResultHashRef.current,
    });

    if (shouldAutoFit) {
      suppressBoundsUpdatesRef.current = 1;
      fitMapToMarkers({ map, markers, marketCountry });
      lastFittedResultHashRef.current = resultHash;
    }

    lastHandledIntentNonceRef.current = cameraIntentNonce;
  }, [
    cameraIntent,
    cameraIntentNonce,
    fitRequestKey,
    map,
    markers,
    marketCountry,
    resolvedFitRequestKey,
    resultHash,
    suppressBoundsUpdatesRef,
  ]);

  return null;
}

function ReportBounds({
  onBoundsChanged,
  suppressBoundsUpdatesRef,
}: {
  onBoundsChanged: (bounds: MapBounds) => void;
  suppressBoundsUpdatesRef: { current: number };
}) {
  const map = useMapEvents({
    moveend() {
      if (suppressBoundsUpdatesRef.current > 0) {
        suppressBoundsUpdatesRef.current -= 1;
        return;
      }
      onBoundsChanged(resolveBounds(map));
    },
  });

  useEffect(() => {
    onBoundsChanged(resolveBounds(map));
  }, [map, onBoundsChanged]);

  return null;
}

function CenterToPreferred({
  preferredCenter,
  cameraIntent,
  cameraIntentNonce,
  suppressBoundsUpdatesRef,
}: {
  preferredCenter: [number, number] | null;
  cameraIntent: "initial" | "idle" | "user_search" | "user_search_area" | "location_change";
  cameraIntentNonce: number;
  suppressBoundsUpdatesRef: { current: number };
}) {
  const map = useMap();
  const lastIntentRef = useRef(0);

  useEffect(() => {
    if (!preferredCenter) return;
    if (cameraIntent !== "location_change") return;
    if (cameraIntentNonce === lastIntentRef.current) return;
    suppressBoundsUpdatesRef.current = 1;
    map.setView(preferredCenter, Math.max(map.getZoom(), 8), { animate: false });
    lastIntentRef.current = cameraIntentNonce;
  }, [cameraIntent, cameraIntentNonce, map, preferredCenter, suppressBoundsUpdatesRef]);

  return null;
}

function SoftPanToHoveredListing({
  hoveredListingId,
  listings,
}: {
  hoveredListingId: string | null;
  listings: Array<MapListing & { latitude: number; longitude: number }>;
}) {
  const map = useMap();
  const lastHoveredIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!hoveredListingId) {
      lastHoveredIdRef.current = null;
      return;
    }
    if (hoveredListingId === lastHoveredIdRef.current) return;
    const listing = listings.find((row) => row.id === hoveredListingId);
    if (!listing) return;
    const paddedBounds = map.getBounds().pad(-0.12);
    const target = L.latLng(listing.latitude, listing.longitude);
    const shouldPan = shouldSoftPanHoveredMarker({
      hoveredListingId,
      lastHoveredListingId: lastHoveredIdRef.current,
      isInsidePaddedViewport: paddedBounds.contains(target),
    });
    if (shouldPan) {
      map.panTo(target, {
        animate: true,
        duration: 0.35,
      });
    }
    lastHoveredIdRef.current = hoveredListingId;
  }, [hoveredListingId, listings, map]);

  return null;
}

function ClusteredMarkerLayer({
  enabled,
  listings,
  selectedListingId,
  hoveredListingId,
  markerIconCache,
  onSelectListing,
  onHoverListing,
}: {
  enabled: boolean;
  listings: Array<MapListing & { latitude: number; longitude: number }>;
  selectedListingId: string | null;
  hoveredListingId: string | null;
  markerIconCache: ReturnType<typeof createShortletMarkerIconCache<L.DivIcon>>;
  onSelectListing: (listingId: string) => void;
  onHoverListing: (listingId: string | null) => void;
}) {
  const map = useMap();
  const clusterGroupRef = useRef<L.MarkerClusterGroup | null>(null);

  useEffect(() => {
    if (!enabled) {
      if (clusterGroupRef.current) {
        map.removeLayer(clusterGroupRef.current);
        clusterGroupRef.current = null;
      }
      return;
    }

    if (!clusterGroupRef.current) {
      clusterGroupRef.current = L.markerClusterGroup({
        maxClusterRadius: 56,
        disableClusteringAtZoom: 14,
        spiderfyOnMaxZoom: true,
        showCoverageOnHover: false,
      });
      map.addLayer(clusterGroupRef.current);
    }

    return () => {
      if (clusterGroupRef.current) {
        map.removeLayer(clusterGroupRef.current);
        clusterGroupRef.current = null;
      }
    };
  }, [enabled, map]);

  useEffect(() => {
    if (!enabled || !clusterGroupRef.current) return;

    const group = clusterGroupRef.current;
    group.clearLayers();

    for (const listing of listings) {
      const markerState = resolveShortletMapMarkerVisualState({
        listingId: listing.id,
        selectedListingId,
        hoveredListingId,
      });
      const label = formatShortletPinPrice(listing.currency, listing.nightlyPriceMinor);
      const icon = markerIconCache.get({
        label,
        mode: markerState.mode,
        create: () => createPricePinIcon(label, markerState.mode),
      });
      const marker = L.marker([listing.latitude, listing.longitude], {
        icon,
        title: listing.title,
        zIndexOffset: markerState.zIndexOffset,
      });
      marker.on("click", () => onSelectListing(listing.id));
      marker.on("mouseover", () => onHoverListing(listing.id));
      marker.on("mouseout", () => onHoverListing(null));
      group.addLayer(marker);
    }
  }, [
    enabled,
    hoveredListingId,
    listings,
    markerIconCache,
    onHoverListing,
    onSelectListing,
    selectedListingId,
  ]);

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
  cameraIntent,
  cameraIntentNonce,
  fitRequestKey,
  resolvedFitRequestKey,
  preferredCenter = null,
  height = "min(70vh, 760px)",
  invalidateNonce = 0,
}: Props) {
  const suppressBoundsUpdatesRef = useRef(0);
  const mapListings = listings.filter(
    (listing): listing is MapListing & { latitude: number; longitude: number } =>
      typeof listing.latitude === "number" && typeof listing.longitude === "number"
  );
  const markerIconCache = useMemo(() => createShortletMarkerIconCache<L.DivIcon>(), []);
  const markers = useMemo(
    () => mapListings.map((listing) => [listing.latitude, listing.longitude] as [number, number]),
    [mapListings]
  );
  const mapMarkerIds = useMemo(() => mapListings.map((listing) => listing.id), [mapListings]);
  const selectedMapMarkerId = useMemo(
    () =>
      retainSelectedShortletMarkerId({
        selectedListingId,
        markerIds: mapMarkerIds,
      }),
    [mapMarkerIds, selectedListingId]
  );
  const clusteringEnabled = useMemo(
    () => shouldEnableShortletMapClustering(mapListings.length),
    [mapListings.length]
  );

  const defaultCenter: [number, number] =
    preferredCenter ??
    (marketCountry === "NG" ? NIGERIA_DEFAULT_CENTER : markers[0] ?? DEFAULT_WORLD_CENTER);
  const defaultZoom = marketCountry === "NG" ? NIGERIA_DEFAULT_ZOOM : 2;
  const selectedListing = useMemo(
    () => listings.find((listing) => listing.id === selectedListingId) ?? null,
    [listings, selectedListingId]
  );

  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
      style={{ height }}
    >
      <MapContainer
        center={defaultCenter}
        zoom={defaultZoom}
        style={{ height: "100%" }}
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
          cameraIntent={cameraIntent}
          cameraIntentNonce={cameraIntentNonce}
          fitRequestKey={fitRequestKey}
          resolvedFitRequestKey={resolvedFitRequestKey}
          suppressBoundsUpdatesRef={suppressBoundsUpdatesRef}
          invalidateNonce={invalidateNonce}
        />
        <CenterToPreferred
          preferredCenter={preferredCenter}
          cameraIntent={cameraIntent}
          cameraIntentNonce={cameraIntentNonce}
          suppressBoundsUpdatesRef={suppressBoundsUpdatesRef}
        />
        <SoftPanToHoveredListing hoveredListingId={hoveredListingId} listings={mapListings} />
        <ReportBounds
          onBoundsChanged={onBoundsChanged}
          suppressBoundsUpdatesRef={suppressBoundsUpdatesRef}
        />
        {clusteringEnabled ? (
          <ClusteredMarkerLayer
            enabled
            listings={mapListings}
            selectedListingId={selectedMapMarkerId}
            hoveredListingId={hoveredListingId}
            markerIconCache={markerIconCache}
            onSelectListing={onSelectListing}
            onHoverListing={onHoverListing}
          />
        ) : (
          mapListings.map((listing) => {
            const markerState = resolveShortletMapMarkerVisualState({
              listingId: listing.id,
              selectedListingId: selectedMapMarkerId,
              hoveredListingId,
            });
            const label = formatShortletPinPrice(listing.currency, listing.nightlyPriceMinor);
            const pinIcon = markerIconCache.get({
              label,
              mode: markerState.mode,
              create: () => createPricePinIcon(label, markerState.mode),
            });
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
          })
        )}
      </MapContainer>
      {selectedListing ? (
        <div className="pointer-events-none absolute bottom-3 left-3 right-3 z-[450] sm:right-auto sm:w-[320px]">
          <div className="pointer-events-auto overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
            <div className="flex items-center gap-3 p-3">
              <div className="h-14 w-20 shrink-0 overflow-hidden rounded-lg bg-slate-100">
                {selectedListing.mapPreviewImageUrl || selectedListing.primaryImageUrl ? (
                  <Image
                    src={selectedListing.mapPreviewImageUrl ?? selectedListing.primaryImageUrl ?? ""}
                    alt={selectedListing.title}
                    width={80}
                    height={56}
                    className="h-full w-full object-cover"
                    sizes="80px"
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
                  {formatShortletPinPrice(selectedListing.currency, selectedListing.nightlyPriceMinor)} / night
                </p>
                <div className="mt-2">
                  <Link
                    href={selectedListing.href}
                    className="inline-flex items-center rounded-full bg-slate-900 px-3 py-1 text-[11px] font-semibold text-white hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                    data-testid="shortlets-map-preview-cta"
                  >
                    {resolveShortletsMapPreviewCtaLabel({
                      bookingMode: selectedListing.bookingMode,
                      nightlyPriceMinor: selectedListing.nightlyPriceMinor,
                      pricingMode: selectedListing.pricingMode,
                    })}
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
