import React, { useMemo, useEffect } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const PALETTE_HEX = [
  "#7c3aed",
  "#0d9488",
  "#ea580c",
  "#db2777",
  "#2563eb",
  "#059669",
  "#d97706",
];

function FitBounds({ points }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView([points[0].lat, points[0].lng], 15);
      return;
    }
    const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lng]));
    map.fitBounds(bounds, { padding: [30, 30], maxZoom: 16 });
  }, [points, map]);
  return null;
}

export default function CustomerMap({ rows, kecamatans }) {
  const points = useMemo(() => {
    return rows
      .map((r) => {
        const lat = parseFloat(r.latitude);
        const lng = parseFloat(r.longitude);
        if (isNaN(lat) || isNaN(lng) || (lat === 0 && lng === 0)) return null;
        const kecIndex = kecamatans.indexOf(r.kecamatan);
        const color = PALETTE_HEX[kecIndex >= 0 ? kecIndex % PALETTE_HEX.length : 0];
        return { ...r, lat, lng, color };
      })
      .filter(Boolean);
  }, [rows, kecamatans]);

  const center = useMemo(() => {
    if (points.length === 0) return [0.5071, 101.4478]; // default Pekanbaru
    const lat = points.reduce((s, p) => s + p.lat, 0) / points.length;
    const lng = points.reduce((s, p) => s + p.lng, 0) / points.length;
    return [lat, lng];
  }, [points]);

  if (points.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-sm text-slate-400">
        Tidak ada koordinat valid pada data yang difilter.
      </div>
    );
  }

  return (
    <MapContainer
      center={center}
      zoom={11}
      style={{ height: "100%", width: "100%", borderRadius: "1rem" }}
      key={points.length} // force re-fit when filter changes drastically
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; OpenStreetMap contributors'
      />
      <FitBounds points={points} />
      {points.map((p, i) => (
        <CircleMarker
          key={i}
          center={[p.lat, p.lng]}
          radius={5}
          pathOptions={{
            color: "#fff",
            weight: 1,
            fillColor: p.color,
            fillOpacity: 0.85,
          }}
        >
          <Popup>
            <div style={{ fontSize: 12, lineHeight: 1.5 }}>
              <strong>{p.nama_pelanggan}</strong>
              <br />
              {p.alamat}
              <br />
              <span style={{ color: "#64748b" }}>
                {p.kelurahan}, {p.kecamatan}
              </span>
              <br />
              <span style={{ color: "#94a3b8" }}>{p.id_pelanggan}</span>
            </div>
          </Popup>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}
