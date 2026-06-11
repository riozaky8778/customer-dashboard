import React, { useState, useMemo } from "react";
import Papa from "papaparse";
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
  return key.trim().toLowerCase().replace(/\./g, "").replace(/\s+/g, "_");
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

export default function CustomerDashboard() {
  const [rows, setRows] = useState([]);
  const [fileName, setFileName] = useState("");
  const [status, setStatus] = useState("");
  const [kecFilter, setKecFilter] = useState("Semua");
  const [kotaFilter, setKotaFilter] = useState("Semua");
  const [statusFilter, setStatusFilter] = useState("Semua");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 12;

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setFileName(file.name);
    setStatus("Membaca file...");
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const parsed = results.data
          .map((r) => {
            const obj = {};
            Object.keys(r).forEach((k) => (obj[norm(k)] = (r[k] || "").toString().trim()));
            return obj;
          })
          .filter((r) => r.id_pelanggan);
        setRows(parsed);
        setStatus(`Berhasil memuat ${parsed.length} pelanggan`);
        setPage(1);
        setKecFilter("Semua");
        setKotaFilter("Semua");
        setStatusFilter("Semua");
        setSearch("");
      },
      error: () => setStatus("Gagal membaca file."),
    });
  };

  const kecamatans = useMemo(
    () => [...new Set(rows.map((r) => r.kecamatan).filter(Boolean))].sort(),
    [rows]
  );
  const kotas = useMemo(
    () => [...new Set(rows.map((r) => r.kota).filter(Boolean))].sort(),
    [rows]
  );
  const statuses = useMemo(
    () => [...new Set(rows.map((r) => r.status_pelanggan).filter(Boolean))].sort(),
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
        .map((k, i) => ({ name: k, total: kecCounts[k], color: PALETTE[i % PALETTE.length].bar }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 10),
    [kecamatans, kecCounts]
  );

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      const matchKec = kecFilter === "Semua" || r.kecamatan === kecFilter;
      const matchKota = kotaFilter === "Semua" || r.kota === kotaFilter;
      const matchStatus = statusFilter === "Semua" || r.status_pelanggan === statusFilter;
      const s = search.toLowerCase();
      const matchSearch =
        !s ||
        (r.nama_pelanggan || "").toLowerCase().includes(s) ||
        (r.id_pelanggan || "").toLowerCase().includes(s) ||
        (r.alamat || "").toLowerCase().includes(s) ||
        (r.kelurahan || "").toLowerCase().includes(s);
      return matchKec && matchKota && matchStatus && matchSearch;
    });
  }, [rows, kecFilter, kotaFilter, statusFilter, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);

  const activeFilterCount = [kecFilter, kotaFilter, statusFilter].filter((f) => f !== "Semua").length;

  const resetFilters = () => {
    setKecFilter("Semua");
    setKotaFilter("Semua");
    setStatusFilter("Semua");
    setSearch("");
    setPage(1);
  };

  const exportCSV = () => {
    const csv = Papa.unparse(filtered);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pelanggan_${kecFilter !== "Semua" ? kecFilter.replace(/\s+/g, "_") : "semua"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
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
              Upload CSV
              <input type="file" accept=".csv" onChange={handleFile} className="hidden" />
            </label>
            {rows.length > 0 && (
              <button
                onClick={exportCSV}
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
          <div className="flex flex-col items-center justify-center text-center py-24 border-2 border-dashed border-slate-200 rounded-2xl bg-white">
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-4">
              <Upload size={20} className="text-slate-400" />
            </div>
            <p className="font-medium text-slate-700">Belum ada data</p>
            <p className="text-sm text-slate-500 mt-1 max-w-sm">
              Upload file CSV berisi data pelanggan (ID, nama, alamat, kecamatan, kota, status, dll) untuk mulai
            </p>
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
                <h2 className="text-sm font-semibold text-slate-700 mb-3">Top 10 kecamatan berdasarkan jumlah pelanggan</h2>
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
                    <Bar dataKey="total" radius={[6, 6, 0, 0]}>
                      {chartData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
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

                <Select label="Status" value={statusFilter} onChange={(v) => { setStatusFilter(v); setPage(1); }}>
                  <option value="Semua">Semua status</option>
                  {statuses.map((s) => (
                    <option key={s} value={s}>{s}</option>
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
                      <Th>ID Pelanggan</Th>
                      <Th>Nama</Th>
                      <Th>Alamat</Th>
                      <Th>Kelurahan</Th>
                      <Th>Kecamatan</Th>
                      <Th>Kota</Th>
                      <Th>Status</Th>
                      <Th>Telp</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageRows.map((r, i) => {
                      const kecIndex = kecamatans.indexOf(r.kecamatan);
                      const palette = PALETTE[kecIndex >= 0 ? kecIndex % PALETTE.length : 0];
                      return (
                        <tr key={i} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60 transition-colors">
                          <Td className="font-mono text-xs text-slate-500">{r.id_pelanggan}</Td>
                          <Td className="font-medium text-slate-800">{r.nama_pelanggan}</Td>
                          <Td className="text-slate-500 max-w-[220px] truncate">{r.alamat}</Td>
                          <Td>{r.kelurahan}</Td>
                          <Td>
                            <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${palette.bg} ${palette.text}`}>
                              {r.kecamatan}
                            </span>
                          </Td>
                          <Td>{r.kota}</Td>
                          <Td>
                            <span
                              className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                                r.status_pelanggan === "ACT"
                                  ? "bg-emerald-100 text-emerald-700"
                                  : "bg-slate-100 text-slate-500"
                              }`}
                            >
                              {r.status_pelanggan}
                            </span>
                          </Td>
                          <Td className="font-mono text-xs text-slate-500">{r.telp_1}</Td>
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

function StatCard({ icon, label, value, accent }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 flex items-center gap-3">
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
