# Checksheet PPA Berau: Planning

## Tujuan
Web app publik: pilih template (mis. Truck LT Axor Mercy) → lihat preview tiap sheet → centang/uncentang sheet → unduh PDF blank (A4) untuk diprint. Ada juga tombol unduh xlsx asli.

## Keputusan
| Hal | Keputusan |
|---|---|
| Alur | PDF blank untuk diprint, tidak ada isi online |
| Akses | Link publik, tanpa login |
| Device | PC, Android, tablet |
| Jaringan | Belum diketahui, jadi dibuat bisa offline untuk yang sudah pernah dibuka |
| Hosting | Cloudflare Pages (gratis, CDN cepat, bandwidth tanpa batas) |
| Maintenance | Upload xlsx ke GitHub, lalu GitHub Action convert + deploy otomatis |
| Teks situs | "Girimulya/BIB" dihapus; kode dok `PPA-BIB-...` dihapus dulu, nanti diganti kode Berau lewat `config.json` |
| Nama file | `Checksheet-<Template>_<YYYY-MM-DD>.pdf` |
| Tampilan | Ikut warna/gaya form Excel |
| Fit A4 | Pilih setelah lihat sampel (1 sheet = 1 halaman vs lebar pas) |

## Arsitektur (tanpa server, tanpa database)
```
templates/*.xlsx  ──push──▶ GitHub Action
                             1. ganti teks sesuai config.json (edit XML langsung, format/gambar aman)
                             2. set page setup A4
                             3. LibreOffice headless → 1 PDF per sheet
                             4. thumbnail WebP kecil per sheet
                             5. generate manifest.json
                             6. wrangler deploy → Cloudflare Pages
```
Browser:
- `index.html` + JS biasa: daftar per kategori (Truck, Dewatering, High Voltage, Compressor) + cari.
- Halaman template: grid thumbnail + checkbox (default semua dicentang), tap untuk perbesar.
- Unduh: ambil PDF sheet yang dicentang, digabung di browser (pdf-lib, dimuat hanya saat unduh).
- Service worker: cache app + file yang sudah dibuka saja (hemat penyimpanan HP).

## Kenapa bukan Apps Script
Tidak bisa offline, lambat di sinyal lemah, kuota akun gratis ketat, dan convert xlsx→PDF per sheet di Apps Script ribet.

## Langkah berikut
1. Install LibreOffice lokal, buat sampel A4 (2 versi) dari 1 template, lalu user pilih.
2. Script build + config.json.
3. Frontend + service worker.
4. GitHub repo + Action + Cloudflare Pages.
