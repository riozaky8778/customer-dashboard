import React, { useMemo, useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix default icon path issue with bundlers
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const PALETTE_HEX = [
  "#7c3aed",
  "#0d9488",
  "#ea580c",
  "#db2777",
  "#2563eb",
  "#059669",
  "#d97706",
];

function makeColorIcon(color) {
  return L.divIcon({
    className: "",
    html: `<div style="width:14px;height:14px;border-radius:50%;background:${color};border:2px solid white;box-shadow:0 0 0 1px rgba(0,0,0,0.15);"></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
}

const iconCache = {};
function getIcon(color) {
  if (!iconCache[color]) iconCache[color] = makeColorIcon(color);
  return iconCache[color];
}

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
      <MarkerClusterGroup chunkedLoading>
        {points.map((p, i) => (
          <Marker key={i} position={[p.lat, p.lng]} icon={getIcon(p.color)}>
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
          </Marker>
        ))}
      </MarkerClusterGroup>
    </MapContainer>
  );
}
