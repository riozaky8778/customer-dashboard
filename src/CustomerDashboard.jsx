import React, { useState, useMemo } from "react";
import * as XLSX from "xlsx";
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

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setFileName(file.name);
    setStatus("Membaca file...");

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
            // Normalisasi field jadi string trimmed
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
      } catch (err) {
        setStatus("Gagal membaca file. Pastikan format file benar (.xlsx).");
      }
    };
    reader.onerror = () => setStatus("Gagal membaca file.");
    reader.readAsArrayBuffer(file);
  };

  const kecamatans = useMemo(
    () => [...new Set(rows.map((r) => r.kecamatan).filter(Boolean))].sort(),
    [rows]
  );
  const kotas = useMemo(
    () => [...new Set(rows.map((r) => r.kota).filter(Boolean))].sort(),
    [rows]
  );
  const depos = useMemo(
    () => [...new Set(rows.map((r) => r.id_depo).filter(Boolean))].sort(),
    [rows]
  );

  // Kecamatan list scoped to selected kota
  const kecamatansForKota = useMemo(() => {
    const source = kotaFilter === "Semua" ? rows : rows.filter((r) => r.kota === kotaFilter);
    return [...new Set(source.map((r) => r.kecamatan).filter(Boolean))].sort();
  }, [rows, kotaFilter]);

  const kecCounts = useMemo(() => {
    const source = kotaFilter === "Semua" ? rows : rows.filter((r) => r.kota === kotaFilter);
    const m = {};
    source.forEach((r) => {
      if (r.kecamatan) m[r.kecamatan] = (m[r.kecamatan] || 0) + 1;
    });
    return m;
  }, [rows, kotaFilter]);

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
      const matchKec = kecFilter === "Semua" || r.kecamatan === kecFilter;
      const matchKota = kotaFilter === "Semua" || r.kota === kotaFilter;
      const matchDepo = depoFilter === "Semua" || r.id_depo === depoFilter;
      const s = search.toLowerCase();
      const matchSearch =
        !s ||
        (r.nama_pelanggan || "").toLowerCase().includes(s) ||
        (r.id_pelanggan || "").toLowerCase().includes(s) ||
        (r.alamat || "").toLowerCase().includes(s) ||
        (r.kelurahan || "").toLowerCase().includes(s);
      return matchKec && matchKota && matchDepo && matchSearch;
    });
  }, [rows, kecFilter, kotaFilter, depoFilter, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);

  const activeFilterCount = [kecFilter, kotaFilter, depoFilter].filter((f) => f !== "Semua").length;

  const resetFilters = () => {
    setKecFilter("Semua");
    setKotaFilter("Semua");
    setDepoFilter("Semua");
    setSearch("");
    setPage(1);
  };

  const exportXLSX = () => {
    const exportData = filtered.map((r) => ({
      "ID DEPO": r.id_depo,
      "ID PELANGGAN": r.id_pelanggan,
      "NAMA PELANGGAN": r.nama_pelanggan,
      ALAMAT: r.alamat,
      KELURAHAN: r.kelurahan,
      KECAMATAN: r.kecamatan,
      KOTA: r.kota,
      "ID HIRARKI": r.id_hirarki,
      "TGL JOIN": r.tgl_join,
      LATITUDE: r.latitude,
      LONGITUDE: r.longitude,
    }));
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Pelanggan");
    const name = kecFilter !== "Semua" ? kecFilter : depoFilter !== "Semua" ? `depo_${depoFilter}` : "semua";
    XLSX.writeFile(wb, `pelanggan_${name.toString().replace(/\s+/g, "_")}.xlsx`);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Dashboard Pelanggan</h1>
            <p className="text-sm text-slate-500">Filter dan analisis pelanggan per kecamatan</p>
          </div>
          <div className="flex items-center gap-2">
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

                <Select label="ID Depo" value={depoFilter} onChange={(v) => { setDepoFilter(v); setPage(1); }}>
                  <option value="Semua">Semua depo</option>
                  {depos.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </Select>
              </div>
            </div>

            {/* Map + Table */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              {/* Map */}
              <div className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-col">
                <h2 className="text-sm font-semibold text-slate-700 mb-3">
                  Peta sebaran pelanggan {filtered.length !== rows.length && `(${filtered.length} hasil filter)`}
                </h2>
                <div className="flex-1 min-h-[480px] rounded-xl overflow-hidden">
                  <CustomerMap rows={filtered} kecamatans={kecamatans} />
                </div>
              </div>

              {/* Table */}
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden h-fit">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        <Th>ID Depo</Th>
                        <Th>ID Pelanggan</Th>
                        <Th>Nama</Th>
                        <Th>Alamat</Th>
                        <Th>Kelurahan</Th>
                        <Th>Kecamatan</Th>
                        <Th>Kota</Th>
                        <Th>Tgl Join</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {pageRows.map((r, i) => {
                        const kecIndex = kecamatans.indexOf(r.kecamatan);
                        const palette = PALETTE[kecIndex >= 0 ? kecIndex % PALETTE.length : 0];
                        return (
                          <tr key={i} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60 transition-colors">
                            <Td className="font-mono text-xs text-slate-500">{r.id_depo}</Td>
                            <Td className="font-mono text-xs text-slate-500">{r.id_pelanggan}</Td>
                            <Td className="font-medium text-slate-800">{r.nama_pelanggan}</Td>
                            <Td className="text-slate-500 max-w-[200px] truncate">{r.alamat}</Td>
                            <Td>{r.kelurahan}</Td>
                            <Td>
                              <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${palette.bg} ${palette.text}`}>
                                {r.kecamatan}
                              </span>
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
