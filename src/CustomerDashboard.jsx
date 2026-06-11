import React, { useState, useMemo } from "react";
import Papa from "papaparse";

function norm(key) {
  return key.trim().toLowerCase().replace(/\./g, "").replace(/\s+/g, "_");
}

const ramps = [
  { bg: "#EEEDFE", text: "#3C3489" }, // purple
  { bg: "#E1F5EE", text: "#085041" }, // teal
  { bg: "#FAECE7", text: "#712B13" }, // coral
  { bg: "#FBEAF0", text: "#72243E" }, // pink
  { bg: "#E6F1FB", text: "#0C447C" }, // blue
  { bg: "#EAF3DE", text: "#27500A" }, // green
  { bg: "#FAEEDA", text: "#633806" }, // amber
];

export default function CustomerDashboard() {
  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState("");
  const [kecFilter, setKecFilter] = useState("Semua");
  const [kotaFilter, setKotaFilter] = useState("Semua");
  const [statusFilter, setStatusFilter] = useState("Semua");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 15;

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
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
        setStatus(`Berhasil memuat ${parsed.length} pelanggan.`);
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

  const kecCounts = useMemo(() => {
    const m = {};
    rows.forEach((r) => {
      if (r.kecamatan) m[r.kecamatan] = (m[r.kecamatan] || 0) + 1;
    });
    return m;
  }, [rows]);

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

  const exportCSV = () => {
    const csv = Papa.unparse(filtered);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pelanggan_${kecFilter !== "Semua" ? kecFilter : "semua"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <h1 style={styles.h1}>Dashboard pelanggan per kecamatan</h1>

        <div style={styles.uploadRow}>
          <label style={styles.uploadBtn}>
            Upload data pelanggan (CSV)
            <input type="file" accept=".csv" onChange={handleFile} style={{ display: "none" }} />
          </label>
          {status && <span style={styles.statusText}>{status}</span>}
          {rows.length > 0 && (
            <button style={styles.exportBtn} onClick={exportCSV}>
              Export hasil filter (CSV)
            </button>
          )}
        </div>

        {rows.length === 0 && (
          <div style={styles.empty}>
            Upload file CSV data pelanggan untuk mulai melihat dashboard
          </div>
        )}

        {rows.length > 0 && (
          <>
            <div style={styles.cards}>
              <Card label="Total pelanggan" value={rows.length} />
              <Card label="Kecamatan" value={kecamatans.length} />
              <Card label="Kota" value={kotas.length} />
              <Card label="Ditampilkan" value={filtered.length} />
            </div>

            <div style={styles.filters}>
              <select
                style={styles.select}
                value={kecFilter}
                onChange={(e) => {
                  setKecFilter(e.target.value);
                  setPage(1);
                }}
              >
                <option value="Semua">Semua kecamatan</option>
                {kecamatans.map((k) => (
                  <option key={k} value={k}>
                    {k} ({kecCounts[k]})
                  </option>
                ))}
              </select>

              <select
                style={styles.select}
                value={kotaFilter}
                onChange={(e) => {
                  setKotaFilter(e.target.value);
                  setPage(1);
                }}
              >
                <option value="Semua">Semua kota</option>
                {kotas.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>

              <select
                style={{ ...styles.select, minWidth: 120 }}
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
              >
                <option value="Semua">Semua status</option>
                {statuses.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>

              <input
                type="text"
                placeholder="Cari nama, ID, alamat, kelurahan..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                style={styles.search}
              />
            </div>

            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>ID pelanggan</th>
                    <th style={styles.th}>Nama</th>
                    <th style={styles.th}>Alamat</th>
                    <th style={styles.th}>Kelurahan</th>
                    <th style={styles.th}>Kecamatan</th>
                    <th style={styles.th}>Kota</th>
                    <th style={styles.th}>Status</th>
                    <th style={styles.th}>Telp</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((r, i) => {
                    const kecIndex = kecamatans.indexOf(r.kecamatan);
                    const ramp = ramps[kecIndex >= 0 ? kecIndex % ramps.length : 0];
                    return (
                      <tr key={i} style={styles.tr}>
                        <td style={{ ...styles.td, fontFamily: "monospace", fontSize: 12 }}>
                          {r.id_pelanggan}
                        </td>
                        <td style={styles.td}>{r.nama_pelanggan}</td>
                        <td style={{ ...styles.td, color: "#666" }}>{r.alamat}</td>
                        <td style={styles.td}>{r.kelurahan}</td>
                        <td style={styles.td}>
                          <span
                            style={{
                              ...styles.badge,
                              background: ramp.bg,
                              color: ramp.text,
                            }}
                          >
                            {r.kecamatan}
                          </span>
                        </td>
                        <td style={styles.td}>{r.kota}</td>
                        <td style={styles.td}>
                          <span
                            style={{
                              ...styles.badge,
                              background: r.status_pelanggan === "ACT" ? "#EAF3DE" : "#F1EFE8",
                              color: r.status_pelanggan === "ACT" ? "#27500A" : "#5F5E5A",
                            }}
                          >
                            {r.status_pelanggan}
                          </span>
                        </td>
                        <td style={{ ...styles.td, color: "#666", fontFamily: "monospace", fontSize: 12 }}>
                          {r.telp_1}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {filtered.length === 0 && (
              <p style={{ textAlign: "center", color: "#888", fontSize: 13, padding: "1rem" }}>
                Tidak ada data yang cocok.
              </p>
            )}

            {totalPages > 1 && (
              <div style={styles.pagination}>
                <button
                  style={styles.pageBtn}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  &#8592;
                </button>
                <span style={{ fontSize: 13, color: "#666" }}>
                  Halaman {page} dari {totalPages}
                </span>
                <button
                  style={styles.pageBtn}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  &#8594;
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Card({ label, value }) {
  return (
    <div style={styles.card}>
      <p style={styles.cardLabel}>{label}</p>
      <p style={styles.cardValue}>{value}</p>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "#FAFAF8",
    fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif",
    padding: "2rem 1rem",
  },
  container: {
    maxWidth: 1100,
    margin: "0 auto",
  },
  h1: {
    fontSize: 22,
    fontWeight: 600,
    marginBottom: "1.5rem",
  },
  uploadRow: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    marginBottom: "1.5rem",
    flexWrap: "wrap",
  },
  uploadBtn: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 16px",
    border: "1px solid #D3D1C7",
    borderRadius: 8,
    cursor: "pointer",
    fontSize: 14,
    background: "#fff",
  },
  exportBtn: {
    padding: "8px 16px",
    border: "1px solid #D3D1C7",
    borderRadius: 8,
    cursor: "pointer",
    fontSize: 14,
    background: "#fff",
  },
  statusText: {
    fontSize: 13,
    color: "#666",
  },
  empty: {
    padding: "2rem",
    textAlign: "center",
    color: "#888",
    border: "1px dashed #D3D1C7",
    borderRadius: 12,
    fontSize: 14,
  },
  cards: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
    gap: 12,
    marginBottom: "1.5rem",
  },
  card: {
    background: "#F1EFE8",
    borderRadius: 8,
    padding: "1rem",
  },
  cardLabel: {
    fontSize: 13,
    color: "#666",
    margin: "0 0 4px",
  },
  cardValue: {
    fontSize: 24,
    fontWeight: 600,
    margin: 0,
  },
  filters: {
    display: "flex",
    gap: 8,
    marginBottom: "1rem",
    flexWrap: "wrap",
    alignItems: "center",
  },
  select: {
    minWidth: 160,
    padding: "8px 12px",
    borderRadius: 8,
    border: "1px solid #D3D1C7",
    fontSize: 14,
    background: "#fff",
  },
  search: {
    flex: 1,
    minWidth: 200,
    padding: "8px 12px",
    borderRadius: 8,
    border: "1px solid #D3D1C7",
    fontSize: 14,
  },
  tableWrap: {
    overflowX: "auto",
    background: "#fff",
    borderRadius: 12,
    border: "1px solid #EFEDE6",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: 13,
  },
  th: {
    padding: 10,
    fontWeight: 600,
    color: "#666",
    textAlign: "left",
    borderBottom: "1px solid #EFEDE6",
    whiteSpace: "nowrap",
  },
  td: {
    padding: 10,
  },
  tr: {
    borderBottom: "1px solid #F5F4F0",
  },
  badge: {
    padding: "2px 8px",
    borderRadius: 6,
    fontSize: 12,
    display: "inline-block",
    whiteSpace: "nowrap",
  },
  pagination: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
    marginTop: "1rem",
  },
  pageBtn: {
    padding: "6px 12px",
    borderRadius: 8,
    border: "1px solid #D3D1C7",
    background: "#fff",
    cursor: "pointer",
  },
};
