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

type Props = {
  properties: Property[];
  height?: string;
};

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
  const valid = properties.filter(
    (p) => typeof p.latitude === "number" && typeof p.longitude === "number"
  );

  if (!valid.length) {
    return (
      <div className="flex h-[240px] items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white text-sm text-slate-600">
        No map data yet. Add coordinates to show this listing on the map.
      </div>
    );
  }

  const fallbackCenter: [number, number] = [
    valid[0].latitude as number,
    valid[0].longitude as number,
  ];

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
        <FitToBounds properties={valid} />
        {valid.map((property) => (
          <Marker
            key={property.id}
            position={[property.latitude as number, property.longitude as number]}
            icon={icon}
          >
            <Popup>
              <div className="text-sm font-semibold">{property.title}</div>
              <div className="text-xs text-slate-600">
                {property.city} - {property.rental_type === "short_let" ? "Short-let" : "Long-term"}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
