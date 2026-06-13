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

const DEPO_MAP = {
  "784": "TSMK AIRHITAM",
  "212": "TSMK KERINCI",
  "213": "TSMK DURI",
  "214": "TSMK AIRMOLEK",
  "215": "TSMK BAGANBATU",
  "219": "TSMK PASIRPUTIH",
  "301": "TSMK PALAS",
  "765": "TSMK TALUKKUANTAN",
  "764": "TSMK UJUNGBATU",
  "785": "TSMK HANGTUAH",
  "126": "TSMK DUMAI",
  "220": "TSMK SIAK",
};

function getDepoName(id) {
  if (!id) return "-";
  return DEPO_MAP[id.toString().trim()] || id;
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

export default function CustomerMap({ rows, kecamatans, mismatchMap = {} }) {
  const points = useMemo(() => {
    return rows
      .map((r) => {
        const lat = parseFloat(r.latitude);
        const lng = parseFloat(r.longitude);
        if (isNaN(lat) || isNaN(lng) || (lat === 0 && lng === 0)) return null;
        const geoInfo = mismatchMap[r.id_pelanggan];
        const effectiveKec = geoInfo?.gpsKecamatan || r.kecamatan;
        const isMismatch = geoInfo?.isMismatch === true;
        const isChecked = !!geoInfo;
        const kecIndex = kecamatans.indexOf(effectiveKec);
        const color = PALETTE_HEX[kecIndex >= 0 ? kecIndex % PALETTE_HEX.length : 0];
        return { ...r, lat, lng, color, effectiveKec, isMismatch, isChecked };
      })
      .filter(Boolean);
  }, [rows, kecamatans, mismatchMap]);

  // Pisah mismatch dan normal — render mismatch belakangan supaya di atas
  const normalPoints = useMemo(() => points.filter((p) => !p.isMismatch), [points]);
  const mismatchPoints = useMemo(() => points.filter((p) => p.isMismatch), [points]);

  const center = useMemo(() => {
    if (points.length === 0) return [0.5071, 101.4478];
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

  const renderPopup = (p) => (
    <Popup autoPan={true} autoPanPaddingTopLeft={[10, 80]}>
      <div style={{ fontSize: 12, lineHeight: 1.7, minWidth: 190 }}>
        {p.isMismatch && (
          <div style={{
            background: "#fef3c7",
            border: "1px solid #fcd34d",
            borderRadius: 6,
            padding: "4px 8px",
            marginBottom: 8,
            fontSize: 11,
            fontWeight: 600,
            color: "#92400e",
          }}>
            ⚠️ DATA KOORDINAT TIDAK SESUAI
          </div>
        )}
        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 2 }}>
          {p.nama_pelanggan}
        </div>
        <div style={{ color: "#475569" }}>{p.alamat}</div>
        <div style={{ color: "#64748b" }}>{p.kelurahan}</div>
        <div style={{ marginTop: 6, paddingTop: 6, borderTop: "1px solid #e2e8f0" }}>
          <div style={{ color: "#0d9488", fontWeight: 600 }}>
            📍 Lokasi GPS: {p.effectiveKec}
          </div>
          {p.isMismatch && (
            <div style={{ color: "#dc2626", fontWeight: 600, marginTop: 2 }}>
              ❌ Data lama: {p.kecamatan}
            </div>
          )}
        </div>
        <div style={{ marginTop: 6, paddingTop: 6, borderTop: "1px solid #e2e8f0" }}>
          <div style={{ color: "#7c3aed", fontWeight: 600, fontSize: 11 }}>
            🏭 {getDepoName(p.id_depo)}
          </div>
          <div style={{ color: "#94a3b8", fontSize: 11 }}>{p.id_pelanggan}</div>
        </div>
      </div>
    </Popup>
  );

  return (
    <MapContainer
      center={center}
      zoom={11}
      style={{ height: "100%", width: "100%", borderRadius: "0.75rem", position: "absolute", top: 0, left: 0 }}
      key={points.length}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; OpenStreetMap contributors'
      />
      <FitBounds points={points} />

      {/* Titik normal — render duluan (di bawah) */}
      {normalPoints.map((p, i) => (
        <CircleMarker
          key={`n-${i}`}
          center={[p.lat, p.lng]}
          radius={5}
          pathOptions={{
            color: "#fff",
            weight: 1,
            fillColor: p.color,
            fillOpacity: 0.85,
          }}
        >
          {renderPopup(p)}
        </CircleMarker>
      ))}

      {/* Titik mismatch — render belakangan (di atas), warna merah mencolok */}
      {mismatchPoints.map((p, i) => (
        <CircleMarker
          key={`m-${i}`}
          center={[p.lat, p.lng]}
          radius={9}
          pathOptions={{
            color: "#dc2626",
            weight: 2.5,
            fillColor: "#fca5a5",
            fillOpacity: 0.95,
          }}
        >
          {renderPopup(p)}
        </CircleMarker>
      ))}
    </MapContainer>
  );
}
