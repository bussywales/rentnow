"use client";

import { useEffect } from "react";
import {
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import type { Property } from "@/lib/types";
import "leaflet/dist/leaflet.css";

const icon = L.icon({
  iconUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconAnchor: [12, 41],
});

const CLUSTER_GRID = 0.03;

type Props = {
  properties: Property[];
  height?: string;
};

const cityCenters: Record<string, [number, number]> = {
  lagos: [6.465422, 3.406448],
  "lagos island": [6.4457, 3.4062],
  "victoria island": [6.4281, 3.4219],
  lekki: [6.459964, 3.601521],
  "lekki phase 1": [6.4518, 3.4805],
  ikoyi: [6.4549, 3.4346],
  cairo: [30.0444, 31.2357],
  zamalek: [30.0661, 31.2156],
  nairobi: [-1.2921, 36.8219],
  kilimani: [-1.292066, 36.821945],
  accra: [5.6037, -0.187],
  "east legon": [5.631965, -0.174286],
  dakar: [14.7167, -17.4677],
  almadies: [14.722, -17.492],
  johannesburg: [-26.2041, 28.0473],
  sandton: [-26.1076, 28.0567],
};

function resolveCoords(property: Property): [number, number] | null {
  if (typeof property.latitude === "number" && typeof property.longitude === "number") {
    return [property.latitude, property.longitude];
  }
  const keyParts = [property.neighbourhood, property.city]
    .filter(Boolean)
    .map((s) => s?.toLowerCase() || "");
  for (const key of keyParts) {
    const match = cityCenters[key];
    if (match) return match;
  }
  return null;
}

type Cluster = {
  id: string;
  latitude: number;
  longitude: number;
  count: number;
  items: Property[];
};

function clusterProperties(properties: Property[]): Cluster[] {
  const clusters = new Map<string, Cluster>();
  properties.forEach((property) => {
    const lat = property.latitude as number;
    const lng = property.longitude as number;
    const key = `${Math.round(lat / CLUSTER_GRID)}:${Math.round(lng / CLUSTER_GRID)}`;
    const existing = clusters.get(key);
    if (existing) {
      existing.count += 1;
      existing.items.push(property);
      existing.latitude = (existing.latitude * (existing.count - 1) + lat) / existing.count;
      existing.longitude = (existing.longitude * (existing.count - 1) + lng) / existing.count;
    } else {
      clusters.set(key, {
        id: key,
        latitude: lat,
        longitude: lng,
        count: 1,
        items: [property],
      });
    }
  });
  return Array.from(clusters.values());
}

function clusterIcon(count: number) {
  return L.divIcon({
    html: `<div style="align-items:center;background:#0ea5e9;border-radius:9999px;color:#fff;display:flex;font-weight:600;height:32px;justify-content:center;width:32px;">${count}</div>`,
    className: "",
    iconSize: [32, 32],
  });
}

function FitToBounds({ properties }: { properties: Property[] }) {
  const map = useMap();

  useEffect(() => {
    if (!properties.length) return;
    const bounds = L.latLngBounds(
      properties.map((p) => [p.latitude as number, p.longitude as number])
    );
    map.fitBounds(bounds, { padding: [24, 24] });
  }, [properties, map]);

  return null;
}

export function PropertyMap({ properties, height = "400px" }: Props) {
  const withCoords = properties
    .map((p) => ({ property: p, coords: resolveCoords(p) }))
    .filter((entry) => !!entry.coords)
    .map((entry) => ({
      ...entry.property,
      latitude: entry.coords?.[0],
      longitude: entry.coords?.[1],
    })) as Property[];

  if (!withCoords.length) {
    return (
      <div className="flex h-[240px] items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white text-sm text-slate-600">
        No map data yet. Add coordinates to show this listing on the map.
      </div>
    );
  }

  const fallbackCenter: [number, number] = [
    withCoords[0].latitude as number,
    withCoords[0].longitude as number,
  ];
  const shouldCluster = withCoords.length > 12;
  const clustered = shouldCluster ? clusterProperties(withCoords) : null;

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <MapContainer
        center={fallbackCenter}
        zoom={12}
        style={{ height }}
        scrollWheelZoom={false}
        className="w-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitToBounds properties={withCoords} />
        {clustered
          ? clustered.map((cluster) => (
              <Marker
                key={cluster.id}
                position={[cluster.latitude, cluster.longitude]}
                icon={cluster.count > 1 ? clusterIcon(cluster.count) : icon}
              >
                <Popup>
                  {cluster.count > 1 ? (
                    <div className="text-sm font-semibold">
                      {cluster.count} listings in this area
                    </div>
                  ) : (
                    <>
                      <div className="text-sm font-semibold">{cluster.items[0]?.title}</div>
                      <div className="text-xs text-slate-600">
                        {cluster.items[0]?.city} -{" "}
                        {cluster.items[0]?.rental_type === "short_let"
                          ? "Short-let"
                          : "Long-term"}
                      </div>
                    </>
                  )}
                </Popup>
              </Marker>
            ))
          : withCoords.map((property) => (
              <Marker
                key={property.id}
                position={[property.latitude as number, property.longitude as number]}
                icon={icon}
              >
                <Popup>
                  <div className="text-sm font-semibold">{property.title}</div>
                  <div className="text-xs text-slate-600">
                    {property.city} -{" "}
                    {property.rental_type === "short_let" ? "Short-let" : "Long-term"}
                  </div>
                </Popup>
              </Marker>
            ))}
      </MapContainer>
    </div>
  );
}
