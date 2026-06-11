# Dashboard Pelanggan per Kecamatan

Project React (Vite) siap deploy ke Vercel via GitHub.

## 1. Push ke GitHub

```bash
cd dashboard-pelanggan
git init
git add .
git commit -m "Initial commit: dashboard pelanggan"
git branch -M main
git remote add origin https://github.com/USERNAME/NAMA-REPO.git
git push -u origin main
```

(Buat repo kosong dulu di github.com/new, lalu ganti URL di atas)

## 2. Deploy ke Vercel

1. Buka https://vercel.com -> login (bisa pakai akun GitHub)
2. Klik "Add New" -> "Project"
3. Pilih repo GitHub yang baru di-push
4. Vercel otomatis mendeteksi:
   - Framework: Vite
   - Build command: npm run build
   - Output directory: dist
5. Klik "Deploy"

Setelah selesai, kamu dapat URL publik (contoh: nama-project.vercel.app).
Setiap kali push ke main, Vercel akan auto-deploy ulang.

## Jalankan lokal (opsional, sebelum push)

```bash
npm install
npm run dev
```

## Fitur dashboard

- Upload CSV data pelanggan
- Kartu ringkasan (total pelanggan, jumlah kecamatan, jumlah kota, hasil filter)
- Filter per kecamatan, kota, status pelanggan
- Pencarian nama / ID / alamat / kelurahan
- Export hasil filter ke CSV
- Tabel dengan pagination

## Format CSV

Header kolom (case-insensitive):
ID DEPO, ID PELANGGAN, NAMA PELANGGAN, ALAMAT, KELURAHAN, KECAMATAN, KOTA,
STATUS PELANGGAN, TELP. 1, ... LATITUDE, LONGITUDE

Kolom wajib minimal: ID PELANGGAN, NAMA PELANGGAN, KECAMATAN, KOTA, STATUS PELANGGAN.
