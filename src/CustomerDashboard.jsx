import React, { useState, useMemo, useRef, useCallback, useEffect } from "react";
import * as XLSX from "xlsx";
import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import { point } from "@turf/helpers";
import {
  Upload,
  Download,
  Users,
  MapPin,
  Building2,
  Filter,
  Search,
  ChevronLeft,
  ChevronRight,
  X,
  Info,
  AlertTriangle,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import CustomerMap from "./CustomerMap";

function norm(key) {
  return key.toString().trim().toLowerCase().replace(/\./g, "").replace(/\s+/g, "_");
}

// Handle koordinat dengan koma sebagai desimal, contoh: "0,5235967" -> 0.5235967
function parseCoord(val) {
  if (val === null || val === undefined) return NaN;
  const s = val.toString().trim().replace(",", ".");
  return parseFloat(s);
}

const PALETTE = [
  { bg: "bg-violet-100", text: "text-violet-800", bar: "#7c3aed" },
  { bg: "bg-teal-100", text: "text-teal-800", bar: "#0d9488" },
  { bg: "bg-orange-100", text: "text-orange-800", bar: "#ea580c" },
  { bg: "bg-pink-100", text: "text-pink-800", bar: "#db2777" },
  { bg: "bg-blue-100", text: "text-blue-800", bar: "#2563eb" },
  { bg: "bg-emerald-100", text: "text-emerald-800", bar: "#059669" },
  { bg: "bg-amber-100", text: "text-amber-800", bar: "#d97706" },
];

const REQUIRED_COLUMNS = [
  "ID DEPO",
  "ID PELANGGAN",
  "NAMA PELANGGAN",
  "ALAMAT",
  "KELURAHAN",
  "KECAMATAN",
  "KOTA",
  "ID HIRARKI",
  "TGL JOIN",
  "LATITUDE",
  "LONGITUDE",
];

// Mapping ID Depo → Nama Depo
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

export default function CustomerDashboard() {
  const [rows, setRows] = useState([]);
  const [fileName, setFileName] = useState("");
  const [status, setStatus] = useState("");
  const [kecFilter, setKecFilter] = useState("Semua");
  const [kotaFilter, setKotaFilter] = useState("Semua");
  const [depoFilter, setDepoFilter] = useState("Semua");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 12;

  // GeoJSON polygon state
  const [geoFeatures, setGeoFeatures] = useState(null); // array of GeoJSON features
  const [geoLoading, setGeoLoading] = useState(false);

  // Load GeoJSON otomatis dari public folder kalau ada
  useEffect(() => {
    fetch("/riau-kecamatan.geojson")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.features) setGeoFeatures(data.features);
      })
      .catch(() => {});
  }, []);

  // Geocoding state (hasil lookup polygon)
  const [geocodeProgress, setGeocodeProgress] = useState(null);
  const [mismatchMap, setMismatchMap] = useState({});
  const [showMismatchOnly, setShowMismatchOnly] = useState(false);
  const abortRef = useRef(false);

  // Normalisasi nama kecamatan
  const normKec = (s) => (s || "").toString().toLowerCase().trim().replace(/\s+/g, " ");

  // Lookup kecamatan dari koordinat pakai polygon (sangat cepat, offline)
  const lookupKecamatan = useCallback((lat, lng, features) => {
    if (!features) return null;
    try {
      const pt = point([lng, lat]);
      for (const feature of features) {
        if (booleanPointInPolygon(pt, feature)) {
          return feature.properties.kecamatan;
        }
      }
    } catch {}
    return null;
  }, []);

  // Jalankan validasi polygon — sangat cepat, tidak butuh rate limit
  const runPolygonValidation = useCallback((parsed, features) => {
    if (!features) return;
    abortRef.current = false;
    const withCoord = parsed.filter(
      (r) => !isNaN(r.latitude) && !isNaN(r.longitude) && !(r.latitude === 0 && r.longitude === 0)
    );
    if (withCoord.length === 0) return;

    setGeocodeProgress({ done: 0, total: withCoord.length });
    const result = {};

    // Proses dalam batch kecil supaya UI tidak freeze
    let i = 0;
    function processBatch() {
      const batchSize = 200;
      const end = Math.min(i + batchSize, withCoord.length);
      for (; i < end; i++) {
        if (abortRef.current) break;
        const r = withCoord[i];
        const gpsKec = lookupKecamatan(r.latitude, r.longitude, features);
        if (gpsKec !== null) {
          const isMismatch = normKec(gpsKec) !== normKec(r.kecamatan);
          result[r.id_pelanggan] = { gpsKecamatan: gpsKec, isMismatch };
        }
      }
      setGeocodeProgress({ done: i, total: withCoord.length });
      if (i < withCoord.length && !abortRef.current) {
        setTimeout(processBatch, 0);
      } else {
        setMismatchMap(result);
        setGeocodeProgress(null);
      }
    }
    processBatch();
  }, [lookupKecamatan]);

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setFileName(file.name);
    setStatus("Membaca file...");
    abortRef.current = true;
    setMismatchMap({});
    setGeocodeProgress(null);
    setShowMismatchOnly(false);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target.result);
        const workbook = XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(sheet, { defval: "" });

        const parsed = json
          .map((r) => {
            const obj = {};
            Object.keys(r).forEach((k) => (obj[norm(k)] = r[k]));
            Object.keys(obj).forEach((k) => {
              if (k !== "latitude" && k !== "longitude") {
                obj[k] = (obj[k] ?? "").toString().trim();
              }
            });
            obj.latitude = parseCoord(obj.latitude);
            obj.longitude = parseCoord(obj.longitude);
            return obj;
          })
          .filter((r) => r.id_pelanggan);

        setRows(parsed);
        setStatus(`Berhasil memuat ${parsed.length} pelanggan`);
        setPage(1);
        setKecFilter("Semua");
        setKotaFilter("Semua");
        setDepoFilter("Semua");
        setSearch("");

        // Jalankan validasi polygon (cepat) atau Nominatim kalau GeoJSON belum ada
        if (geoFeatures) {
          runPolygonValidation(parsed, geoFeatures);
        }
      } catch (err) {
        setStatus("Gagal membaca file. Pastikan format file benar (.xlsx).");
      }
    };
    reader.onerror = () => setStatus("Gagal membaca file.");
    reader.readAsArrayBuffer(file);
  };

  // Handler upload file GeoJSON manual (kalau tidak ada di public folder)
  const handleGeoJSON = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setGeoLoading(true);
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = JSON.parse(evt.target.result);
        if (data?.features) {
          setGeoFeatures(data.features);
          setStatus(`GeoJSON dimuat: ${data.features.length} kecamatan`);
          // Kalau data sudah ada, langsung validasi ulang
          if (rows.length > 0) {
            setMismatchMap({});
            runPolygonValidation(rows, data.features);
          }
        }
      } catch {
        setStatus("Gagal membaca file GeoJSON.");
      }
      setGeoLoading(false);
    };
    reader.readAsText(file);
  };

  // Kecamatan efektif: pakai GPS kalau sudah ter-geocode, fallback ke kolom data
  const getEffectiveKec = useCallback((r) => {
    const geo = mismatchMap[r.id_pelanggan];
    if (geo && geo.gpsKecamatan) return geo.gpsKecamatan;
    return r.kecamatan;
  }, [mismatchMap]);

  const kecamatans = useMemo(
    () => [...new Set(rows.map((r) => getEffectiveKec(r)).filter(Boolean))].sort(),
    [rows, getEffectiveKec]
  );
  const kotas = useMemo(
    () => [...new Set(rows.map((r) => r.kota).filter(Boolean))].sort(),
    [rows]
  );
  const depos = useMemo(
    () => [...new Set(rows.map((r) => r.id_depo).filter(Boolean))].sort(),
    [rows]
  );

  // Kecamatan list scoped to selected kota (pakai kecamatan efektif)
  const kecamatansForKota = useMemo(() => {
    const source = kotaFilter === "Semua" ? rows : rows.filter((r) => r.kota === kotaFilter);
    return [...new Set(source.map((r) => getEffectiveKec(r)).filter(Boolean))].sort();
  }, [rows, kotaFilter, getEffectiveKec]);

  const kecCounts = useMemo(() => {
    const source = kotaFilter === "Semua" ? rows : rows.filter((r) => r.kota === kotaFilter);
    const m = {};
    source.forEach((r) => {
      const kec = getEffectiveKec(r);
      if (kec) m[kec] = (m[kec] || 0) + 1;
    });
    return m;
  }, [rows, kotaFilter, getEffectiveKec]);

  const chartData = useMemo(
    () =>
      kecamatans
        .map((k, i) => ({ name: k, total: kecCounts[k] || 0, color: PALETTE[i % PALETTE.length].bar }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 10),
    [kecamatans, kecCounts]
  );

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      const effectiveKec = getEffectiveKec(r);
      const matchKec = kecFilter === "Semua" || effectiveKec === kecFilter;
      const matchKota = kotaFilter === "Semua" || r.kota === kotaFilter;
      const matchDepo = depoFilter === "Semua" || r.id_depo === depoFilter;
      const s = search.toLowerCase();
      const matchSearch =
        !s ||
        (r.nama_pelanggan || "").toLowerCase().includes(s) ||
        (r.id_pelanggan || "").toLowerCase().includes(s) ||
        (r.alamat || "").toLowerCase().includes(s) ||
        (r.kelurahan || "").toLowerCase().includes(s);
      const matchMismatch = !showMismatchOnly || mismatchMap[r.id_pelanggan]?.isMismatch === true;
      return matchKec && matchKota && matchDepo && matchSearch && matchMismatch;
    });
  }, [rows, kecFilter, kotaFilter, depoFilter, search, showMismatchOnly, mismatchMap, getEffectiveKec]);

  const mismatchCount = useMemo(
    () => Object.values(mismatchMap).filter((v) => v.isMismatch).length,
    [mismatchMap]
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);

  const activeFilterCount = [kecFilter, kotaFilter, depoFilter].filter((f) => f !== "Semua").length + (showMismatchOnly ? 1 : 0);

  const resetFilters = () => {
    setKecFilter("Semua");
    setKotaFilter("Semua");
    setDepoFilter("Semua");
    setSearch("");
    setShowMismatchOnly(false);
    setPage(1);
  };

  const exportXLSX = () => {
    const exportData = filtered.map((r) => {
      const geoInfo = mismatchMap[r.id_pelanggan];
      return {
        "ID DEPO": r.id_depo,
        "ID PELANGGAN": r.id_pelanggan,
        "NAMA PELANGGAN": r.nama_pelanggan,
        ALAMAT: r.alamat,
        KELURAHAN: r.kelurahan,
        KECAMATAN: r.kecamatan,
        "KECAMATAN GPS": geoInfo ? geoInfo.gpsKecamatan : "",
        "STATUS KOORDINAT": geoInfo
          ? geoInfo.isMismatch
            ? "MISMATCH"
            : "SESUAI"
          : "BELUM DICEK",
        KOTA: r.kota,
        "ID HIRARKI": r.id_hirarki,
        "TGL JOIN": r.tgl_join,
        LATITUDE: r.latitude,
        LONGITUDE: r.longitude,
      };
    });
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Pelanggan");
    const name = kecFilter !== "Semua" ? kecFilter : depoFilter !== "Semua" ? `depo_${depoFilter}` : "semua";
    XLSX.writeFile(wb, `pelanggan_${name.toString().replace(/\s+/g, "_")}.xlsx`);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white sticky top-0" style={{ zIndex: 1000 }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Dashboard Pelanggan</h1>
            <p className="text-sm text-slate-500">Filter dan analisis pelanggan per kecamatan</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Status GeoJSON */}
            <span className={`text-xs px-2 py-1 rounded-full font-medium ${geoFeatures ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
              {geoFeatures ? `✓ Peta wilayah (${geoFeatures.length} kec)` : "⚠ Belum ada peta wilayah"}
            </span>
            {!geoFeatures && (
              <label className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-medium cursor-pointer hover:bg-slate-50 transition-colors">
                {geoLoading ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
                Upload GeoJSON
                <input type="file" accept=".geojson,.json" onChange={handleGeoJSON} className="hidden" />
              </label>
            )}
            <label className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium cursor-pointer hover:bg-slate-700 transition-colors">
              <Upload size={16} />
              Upload Excel
              <input type="file" accept=".xlsx,.xls" onChange={handleFile} className="hidden" />
            </label>
            {rows.length > 0 && (
              <button
                onClick={exportXLSX}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-300 bg-white text-sm font-medium hover:bg-slate-50 transition-colors"
              >
                <Download size={16} />
                Export
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {rows.length === 0 ? (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col items-center justify-center text-center py-16 border-2 border-dashed border-slate-200 rounded-2xl bg-white">
              <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-4">
                <Upload size={20} className="text-slate-400" />
              </div>
              <p className="font-medium text-slate-700">Belum ada data</p>
              <p className="text-sm text-slate-500 mt-1 max-w-sm">
                Upload file Excel (.xlsx) berisi data pelanggan untuk mulai
              </p>
              {status && <p className="text-sm text-rose-500 mt-3">{status}</p>}
            </div>

            {/* Info panel */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
                  <Info size={16} />
                </div>
                <div className="text-sm text-slate-600 space-y-3">
                  <div>
                    <p className="font-medium text-slate-800 mb-1">Format kolom yang wajib ada (xlsx):</p>
                    <div className="flex flex-wrap gap-1.5">
                      {REQUIRED_COLUMNS.map((c) => (
                        <span
                          key={c}
                          className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-xs font-mono"
                        >
                          {c}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="border-t border-slate-100 pt-3 space-y-1 text-slate-500">
                    <p>• Urutan kolom bebas, namun nama header harus sesuai (huruf besar/kecil tidak masalah).</p>
                    <p>• Pastikan data yang diupload hanya <span className="font-medium text-slate-700">pelanggan aktif</span>.</p>
                    <p>• LATITUDE dan LONGITUDE wajib diisi agar pelanggan tampil di peta.</p>
                    <p>• Format file: <span className="font-medium text-slate-700">.xlsx</span> (Excel), bukan CSV.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <>
            {status && (
              <div className="mb-4 text-sm text-slate-500">
                {status} {fileName && <span className="text-slate-400">— {fileName}</span>}
              </div>
            )}

            {/* Geocoding progress bar */}
            {geocodeProgress && (
              <div className="mb-4 bg-blue-50 border border-blue-200 rounded-xl p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Loader2 size={14} className="text-blue-500 animate-spin" />
                  <span className="text-sm font-medium text-blue-700">
                    Memvalidasi koordinat… {geocodeProgress.done}/{geocodeProgress.total}
                  </span>
                  <button
                    onClick={() => { abortRef.current = true; setGeocodeProgress(null); }}
                    className="ml-auto text-xs text-blue-400 hover:text-blue-600"
                  >
                    Batalkan
                  </button>
                </div>
                <div className="w-full bg-blue-100 rounded-full h-1.5">
                  <div
                    className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
                    style={{ width: `${(geocodeProgress.done / geocodeProgress.total) * 100}%` }}
                  />
                </div>
                <p className="text-xs text-blue-400 mt-1">
                  Validasi offline via polygon kecamatan — tidak perlu internet
                </p>
              </div>
            )}

            {/* Mismatch summary alert */}
            {!geocodeProgress && mismatchCount > 0 && (
              <div className="mb-4 bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-3">
                <AlertTriangle size={16} className="text-amber-500 mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-amber-800">
                    {mismatchCount} pelanggan memiliki kecamatan berbeda antara data dan GPS
                  </p>
                  <p className="text-xs text-amber-600 mt-0.5">
                    Kolom KECAMATAN di data mungkin sudah tidak sesuai posisi koordinat sebenarnya.
                  </p>
                </div>
                <button
                  onClick={() => { setShowMismatchOnly((v) => !v); setPage(1); }}
                  className={`flex-shrink-0 text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                    showMismatchOnly
                      ? "bg-amber-500 text-white"
                      : "bg-amber-100 text-amber-700 hover:bg-amber-200"
                  }`}
                >
                  {showMismatchOnly ? "Tampilkan semua" : "Lihat yang mismatch"}
                </button>
              </div>
            )}

            {/* Selesai verifikasi tanpa mismatch */}
            {!geocodeProgress && mismatchCount === 0 && Object.keys(mismatchMap).length > 0 && (
              <div className="mb-4 bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center gap-2">
                <CheckCircle2 size={15} className="text-emerald-500" />
                <p className="text-sm text-emerald-700">
                  Semua koordinat sesuai dengan kolom kecamatan di data.
                </p>
              </div>
            )}

            {/* Stat cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <StatCard icon={<Users size={18} />} label="Total pelanggan" value={rows.length} accent="bg-violet-50 text-violet-600" />
              <StatCard icon={<MapPin size={18} />} label="Kecamatan" value={kecamatans.length} accent="bg-teal-50 text-teal-600" />
              <StatCard icon={<Building2 size={18} />} label="Kota" value={kotas.length} accent="bg-orange-50 text-orange-600" />
              <StatCard icon={<Filter size={18} />} label="Hasil filter" value={filtered.length} accent="bg-blue-50 text-blue-600" />
            </div>

            {/* Chart + filters layout */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
              <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-4">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-semibold text-slate-700">Top 10 kecamatan berdasarkan jumlah pelanggan</h2>
                  <span className="text-xs text-slate-400">Klik bar untuk filter</span>
                </div>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={chartData} margin={{ top: 4, right: 8, left: -16, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 11, fill: "#64748b" }}
                      angle={-30}
                      textAnchor="end"
                      height={60}
                      interval={0}
                    />
                    <YAxis tick={{ fontSize: 11, fill: "#64748b" }} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }}
                      cursor={{ fill: "#f8fafc" }}
                    />
                    <Bar
                      dataKey="total"
                      radius={[6, 6, 0, 0]}
                      cursor="pointer"
                      onClick={(data) => {
                        if (!data || !data.name) return;
                        setKecFilter((prev) => (prev === data.name ? "Semua" : data.name));
                        setKotaFilter("Semua");
                        setPage(1);
                      }}
                    >
                      {chartData.map((entry, i) => (
                        <Cell
                          key={i}
                          fill={entry.color}
                          opacity={kecFilter === "Semua" || kecFilter === entry.name ? 1 : 0.3}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Filters panel */}
              <div className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                    <Filter size={14} /> Filter
                  </h2>
                  {activeFilterCount > 0 && (
                    <button
                      onClick={resetFilters}
                      className="text-xs text-slate-400 hover:text-slate-700 inline-flex items-center gap-1"
                    >
                      <X size={12} /> Reset
                    </button>
                  )}
                </div>

                <div className="relative">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Cari nama, ID, alamat, kelurahan..."
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setPage(1);
                    }}
                    className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
                  />
                </div>

                <Select label="Kecamatan" value={kecFilter} onChange={(v) => { setKecFilter(v); setPage(1); }}>
                  <option value="Semua">Semua kecamatan</option>
                  {kecamatansForKota.map((k) => (
                    <option key={k} value={k}>
                      {k} ({kecCounts[k]})
                    </option>
                  ))}
                </Select>

                <Select
                  label="Kota"
                  value={kotaFilter}
                  onChange={(v) => {
                    setKotaFilter(v);
                    setKecFilter("Semua");
                    setPage(1);
                  }}
                >
                  <option value="Semua">Semua kota</option>
                  {kotas.map((k) => (
                    <option key={k} value={k}>{k}</option>
                  ))}
                </Select>

                <Select label="Depo" value={depoFilter} onChange={(v) => { setDepoFilter(v); setPage(1); }}>
                  <option value="Semua">Semua depo</option>
                  {depos.map((d) => (
                    <option key={d} value={d}>{getDepoName(d)}</option>
                  ))}
                </Select>

                {/* Toggle mismatch filter */}
                {(mismatchCount > 0 || geocodeProgress) && (
                  <button
                    onClick={() => { setShowMismatchOnly((v) => !v); setPage(1); }}
                    disabled={!!geocodeProgress}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                      showMismatchOnly
                        ? "bg-amber-50 border-amber-300 text-amber-700"
                        : "border-slate-200 text-slate-600 hover:bg-slate-50"
                    } disabled:opacity-40`}
                  >
                    <span className="flex items-center gap-2">
                      <AlertTriangle size={13} className={showMismatchOnly ? "text-amber-500" : "text-slate-400"} />
                      Mismatch kecamatan
                    </span>
                    {geocodeProgress ? (
                      <Loader2 size={12} className="animate-spin text-slate-400" />
                    ) : (
                      <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${
                        mismatchCount > 0 ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-400"
                      }`}>
                        {mismatchCount}
                      </span>
                    )}
                  </button>
                )}
              </div>
            </div>

            {/* Map + Table */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              {/* Map */}
              <div className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-col">
                <h2 className="text-sm font-semibold text-slate-700 mb-3">
                  Peta sebaran pelanggan {filtered.length !== rows.length && `(${filtered.length} hasil filter)`}
                </h2>
                <div style={{ height: 480, borderRadius: "0.75rem", overflow: "hidden", position: "relative" }}>
                  <CustomerMap rows={filtered} kecamatans={kecamatans} mismatchMap={mismatchMap} />
                </div>
              </div>

              {/* Table */}
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden h-fit">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        <Th>Depo</Th>
                        <Th>ID Pelanggan</Th>
                        <Th>Nama</Th>
                        <Th>Alamat</Th>
                        <Th>Kelurahan</Th>
                        <Th>Kecamatan GPS</Th>
                        <Th>Kecamatan Data</Th>
                        <Th>Kota</Th>
                        <Th>Tgl Join</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {pageRows.map((r, i) => {
                        const effectiveKec = getEffectiveKec(r);
                        const kecIndex = kecamatans.indexOf(effectiveKec);
                        const palette = PALETTE[kecIndex >= 0 ? kecIndex % PALETTE.length : 0];
                        const geoInfo = mismatchMap[r.id_pelanggan];
                        const isMismatch = geoInfo?.isMismatch === true;
                        const geocoded = !!geoInfo;
                        return (
                          <tr
                            key={i}
                            className={`border-b border-slate-100 last:border-0 transition-colors ${
                              isMismatch
                                ? "bg-amber-50/60 hover:bg-amber-50"
                                : "hover:bg-slate-50/60"
                            }`}
                          >
                            <Td>
                              <div className="text-xs">
                                <span className="font-medium text-slate-700">{getDepoName(r.id_depo)}</span>
                                <span className="text-slate-400 block">{r.id_depo}</span>
                              </div>
                            </Td>
                            <Td className="font-mono text-xs text-slate-500">{r.id_pelanggan}</Td>
                            <Td className="font-medium text-slate-800">{r.nama_pelanggan}</Td>
                            <Td className="text-slate-500 max-w-[200px] truncate">{r.alamat}</Td>
                            <Td>{r.kelurahan}</Td>
                            <Td>
                              {geocoded ? (
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${palette.bg} ${palette.text}`}>
                                  {isMismatch && <CheckCircle2 size={10} />}
                                  {effectiveKec}
                                </span>
                              ) : (
                                <span className="text-xs text-slate-300 flex items-center gap-1">
                                  <Loader2 size={10} className={geocodeProgress ? "animate-spin" : ""} />
                                  menunggu...
                                </span>
                              )}
                            </Td>
                            <Td>
                              {isMismatch ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700 whitespace-nowrap">
                                  <AlertTriangle size={10} />
                                  {r.kecamatan}
                                </span>
                              ) : (
                                <span className="text-xs text-slate-400">{r.kecamatan}</span>
                              )}
                            </Td>
                            <Td>{r.kota}</Td>
                            <Td className="text-xs text-slate-500 whitespace-nowrap">{r.tgl_join}</Td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {filtered.length === 0 && (
                  <p className="text-center text-sm text-slate-400 py-10">Tidak ada data yang cocok dengan filter.</p>
                )}

                {totalPages > 1 && (
                  <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
                    <p className="text-xs text-slate-400">
                      Menampilkan {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, filtered.length)} dari {filtered.length}
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page === 1}
                        className="p-1.5 rounded-lg border border-slate-200 disabled:opacity-30 hover:bg-slate-50"
                      >
                        <ChevronLeft size={16} />
                      </button>
                      <span className="text-xs text-slate-500 min-w-[80px] text-center">
                        Halaman {page} / {totalPages}
                      </span>
                      <button
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        disabled={page === totalPages}
                        className="p-1.5 rounded-lg border border-slate-200 disabled:opacity-30 hover:bg-slate-50"
                      >
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function StatCard({ icon, label, value, accent, onClick, active }) {
  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-2xl border p-4 flex items-center gap-3 transition-colors ${
        onClick ? "cursor-pointer hover:border-slate-300" : ""
      } ${active ? "border-slate-900 ring-1 ring-slate-900/10" : "border-slate-200"}`}
    >
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${accent}`}>{icon}</div>
      <div>
        <p className="text-xs text-slate-500">{label}</p>
        <p className="text-xl font-semibold text-slate-900">{value}</p>
      </div>
    </div>
  );
}

function Select({ label, value, onChange, children }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-slate-500 mb-1">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
      >
        {children}
      </select>
    </label>
  );
}

function Th({ children }) {
  return <th className="text-left font-semibold text-slate-500 text-xs uppercase tracking-wide px-3 py-3 whitespace-nowrap">{children}</th>;
}

function Td({ children, className = "" }) {
  return <td className={`px-3 py-2.5 ${className}`}>{children}</td>;
}
