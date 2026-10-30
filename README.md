# JASAhub — Vercel + Supabase, UI asli tetap dipertahankan

Paket migrasi ini menggunakan HTML/CSS dan renderer JASAhub terbaru, bersumber
dari JASAhub-id-fullcode.zip versi 10. Tidak membutuhkan Apps Script, Sheets,
Google Drive, atau Google Cloud untuk operasi website setelah migrasi selesai.

**Status:** kode, skema database, alat impor, dan uji lokal sudah tersedia.
Proyek/database/cloud milikmu BELUM diubah. Isi `.env`/environment Vercel,
jalankan SQL dan impor data lama untuk mengaktifkan deployment nyata.

## Yang dipertahankan

- Tema Dark Tech Purple, warna, font, glow, jarak dan susunan halaman.
- Hero, logo, SVG, sidebar, katalog dua kolom pada mobile.
- Navigasi bawah, dock checkout, skeleton, smooth scroll.
- Form login nomor WhatsApp/username, daftar nama/nomor/password.
- Paket Basic/Standard/Premium dan tombol hapus/urungkan paket.
- Galeri, QRIS, bukti pembayaran manual melalui WhatsApp.
- Status Belum Dibayar -> Proses Pengerjaan -> Selesai.
- Dashboard pelanggan/admin, filter pesanan, profil dan perubahan password.

Kedua blok CSS, markup dokumen sebelum script, dan byte logo asli tidak diubah.
Sebelas renderer diuji menggunakan data yang sama dengan versi lama: kartu,
landing/katalog, grid, detail, dock checkout, navigasi bawah, checkout, login,
daftar, kartu pesanan dan daftar pesanan admin. Hasil HTML-nya identik.
Keterangan penyimpanan pada form admin disesuaikan dari Drive ke Supabase.
Verifikasi piksel/screenshot pada browser belum dilakukan karena browser
Chromium/Firefox/WebKit tidak terpasang di lingkungan pengujian.

## Pembagian sistem

| Bagian | Tempat |
| --- | --- |
| HTML, CSS, logo dan JavaScript | Vercel, direktori public |
| API katalog, akun, pesanan, admin | Vercel Functions |
| Akun dan password | Supabase Auth; password dikelola/hash oleh Supabase |
| Profil, role, kategori, jasa, paket, pesanan | Supabase Postgres |
| Thumbnail, galeri, logo unggahan, QRIS | Supabase Storage |
| Berkas hasil/bahan berupa URL | Tetap memakai tautan yang diberikan pelanggan/admin |

Berkas hasil dari versi lama tetap berupa tautan. Paket ini mempertahankan form
URL hasil; tidak menambahkan form unggah hasil baru yang mengubah desain.
Tautan eksternal yang sudah disimpan tidak otomatis menyalin seluruh dokumennya.

## Struktur proyek

| Lokasi | Fungsi |
| --- | --- |
| public/index.html | HTML + CSS asli |
| public/assets/jasahub.js | Renderer asli, API same-origin, sesi cookie |
| public/assets/logo.png | Gambar logo asli |
| api/jasa.js | Katalog publik; CDN cache 10 menit |
| api/rpc.js | Akun, checkout, admin; tanpa cache |
| api/media.js | Byte gambar yang terdaftar; cache terpisah |
| lib/supabase.js | Koneksi REST Supabase privat dari server |
| lib/session.js | Cookie terenkripsi HttpOnly dan pembaruan token |
| lib/auth.js | Supabase Auth, profil dan rate limit |
| lib/engine.js | Validasi bisnis dengan kontrak data UI lama |
| lib/media.js | Unggah/download Supabase Storage |
| supabase/schema.sql | Tabel, trigger, RLS, transaksi dan bucket |
| supabase/verify.sql | Pemeriksaan izin sesudah instalasi |
| scripts/Export-Legacy.gs | Ekspor satu kali dari Apps Script lama |
| scripts/import-legacy.js | Impor akun, data dan media lama |
| scripts/create-admin.js | Membuat admin untuk instalasi baru |
| scripts/dev.js | Server pengembangan lokal |
| tests/ | Uji backend dan kesamaan hasil renderer |

Tidak ada rewrite catch-all yang mengalihkan /api atau /assets ke index.html.
Folder public tidak ditulis dalam URL. Script menggunakan:

```html
<script src="/assets/jasahub.js" defer></script>
```

Google Fonts tetap memakai URL HTTPS asli agar font tidak berubah.

## 1. Siapkan Supabase

1. Buat proyek Supabase baru. Pilih region yang dekat dengan mayoritas pengguna.
2. Buka SQL Editor. Jalankan seluruh isi `supabase/schema.sql`.
3. Jalankan `supabase/verify.sql`. Semua tabel yang terdaftar harus mengaktifkan
   RLS, izin execute anon/authenticated pada fungsi privat harus false, dan
   bucket jasahub-media harus `public=false`.
4. Buka Authentication > Providers/Sign In. Email/password harus aktif.
   **Matikan pendaftaran publik langsung** (Allow new users to sign up). Website
   membuat akun dari API server melalui Admin API. Jangan aktifkan login anonymous.
5. Salin Project URL dan API key ke konfigurasi server. Paket diuji dengan
   **legacy anon key** dan **legacy service_role key** dari halaman API Keys.
   service_role tidak boleh dimasukkan ke file HTML/JavaScript publik.

Tabel konten menggunakan kolom `record_id`, `ordinal`, dan `data` (JSONB) agar
seluruh field dari versi lama dapat dipertahankan. Admin JASAhub tetap menjadi
cara utama mengedit jasa/paket/pesanan. Akun dan role berada di tabel profiles.
Database hanya bisa diakses API server; anon/authenticated tidak diberi akses
langsung. Jangan menambahkan policy `using (true)` pada tabel pribadi.

## 2. Konfigurasi server

Salin `.env.example` menjadi `.env` pada komputer sendiri. Isi:

| Variabel | Sumber |
| --- | --- |
| SUPABASE_URL | Project URL |
| SUPABASE_ANON_KEY | Legacy anon API key |
| SUPABASE_SERVICE_ROLE_KEY | Legacy service_role API key; privat |
| SESSION_SECRET | 64 karakter hex acak; gunakan nilai yang tetap |

Buat SESSION_SECRET dengan Node.js:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Gunakan Node.js 24. Jangan commit `.env`, ekspor data pelanggan, checkpoint,
reset-passwords.json atau kredensial ke repository. `.gitignore` sudah disediakan.
Mengganti SESSION_SECRET akan mengakhiri sesi aplikasi yang sudah ada.

## 3A. Migrasikan data lama dari Sheets dan Drive

Lakukan sebelum website baru menerima pesanan. Cadangkan Spreadsheet dan folder
media. Hentikan sementara perubahan pada website lama selama ekspor/impor supaya
pesanan baru tidak tertinggal di database lama.

1. Buka Apps Script lama yang sudah terhubung ke Spreadsheet kerja.
2. Tambahkan satu file sementara, tempel isi `scripts/Export-Legacy.gs`.
3. Jalankan `exportJASAhubMigration()` dan izinkan akses Sheets/Drive.
4. Buka execution log; unduh `JASAhub-private-export.zip` dari Drive sendiri.
   Ekspor ini memuat data pelanggan dan password lama. Jangan mempublikasikannya.
5. Ekstrak ZIP ke folder lokal `legacy-export`. Isi utamanya `data.json` dan
   subfolder `media`. Jika log melaporkan gambar gagal, perbaiki izin Drive lalu
   ekspor ulang. Jika ekspor terlalu besar untuk batas Apps Script, pecah ekspor
   media secara manual sebelum melanjutkan; jangan mengabaikan gambar yang hilang.
6. Periksa format tanpa menulis ke Supabase:

   ```bash
   npm run import -- ./legacy-export --dry-run
   ```

7. Pastikan .env mengarah ke proyek Supabase yang benar, lalu jalankan:

   ```bash
   npm run import -- ./legacy-export
   ```

8. Periksa migration-report.json dan jumlah record melalui verify.sql.
   Impor memetakan ID pelanggan lama ke ID Supabase Auth agar riwayat pesanan
   tetap terkait dengan akun yang benar. Paket, preview dan ID pesanan dipertahankan.
   Referensi drive: diganti ke storage: setelah gambar dipindahkan.
9. Password lama yang tersedia sebagai plain text dan panjangnya memenuhi minimum
   dapat dipakai kembali. Supabase menyimpannya sebagai kredensial Auth yang di-hash;
   paket baru tidak membuat kolom password plain pada database aplikasi.
10. Jika password lama hanya tersedia sebagai hash atau kurang dari 6 karakter,
    importer membuat password acak. Daftar reset disimpan di reset-passwords.json
    lokal. Sampaikan secara privat atau atur ulang oleh admin; password tidak
    dicetak di terminal. Sesi Apps Script lama tidak dipindahkan.
11. Importer menyimpan checkpoint ID. Jika gagal, perbaiki penyebabnya lalu ulangi
    pada ekspor yang sama. Jika akun sudah dibuat tetapi legacy_id belum tersimpan,
    importer berhenti agar tidak mengambil alih akun lain: periksa identitas di
    dashboard, isi legacy_id yang benar, lalu lanjutkan.
12. Jangan menjalankan ulang ekspor lama sesudah website baru menerima transaksi,
    karena upsert konten dapat menimpa pembaruan terbaru dengan data ekspor lama.

Admin lama ikut diimpor dari role dan username di Users. Jangan menjalankan
create-admin jika akun admin lama sudah diimpor. Setiap file eksternal ber-URL
HTTPS yang tidak tercatat dalam tabel Media tetap berupa tautan eksternal;
ganti melalui admin jika ingin seluruh gambar tersimpan di Supabase.

Sesudah migrasi terverifikasi, hapus ekspor privat dan berkas reset dari lokasi
berbagi; simpan cadangan pribadi yang diperlukan. Hapus helper ekspor dari project
lama. Helper tersebut tidak diperlukan saat website baru berjalan.

## 3B. Jika ingin instalasi kosong

Lewati impor. Isi ADMIN_USERNAME, ADMIN_NAME dan ADMIN_PASSWORD di .env lokal.
ADMIN_PHONE opsional. Kemudian jalankan:

```bash
npm run create-admin
```

Script menolak menimpa username yang sudah ada. Tidak ada akun/password admin
bawaan yang dibuat otomatis saat deploy. Setelah masuk, isi kategori, jasa,
nomor WhatsApp dan QRIS melalui dashboard yang sama seperti sebelumnya.

## 4. Login tanpa mengubah form

Form tetap nomor WhatsApp/username dan password. Di server, nomor Indonesia
08.../+62... dinormalisasi dan dipetakan ke alamat login internal deterministik
untuk Supabase Auth. Pengguna tidak diminta mengisi email baru, dan email internal
ini tidak dipakai mengirim pesan. Admin login menggunakan username yang disimpan.

Registrasi tidak mengirim OTP atau memverifikasi kepemilikan nomor telepon,
sama seperti versi lama. Keterangan nomor belum diverifikasi tetap ada pada UI.
Pemulihan password otomatis melalui email/SMS belum ditambahkan.

Token akses dan refresh disimpan dalam cookie aplikasi terenkripsi HttpOnly,
SameSite=Lax; Secure aktif di produksi. Browser hanya menyimpan penanda login,
bukan password/token Supabase dalam localStorage. API memperbarui token yang
kedaluwarsa. Gangguan jaringan tidak menghapus sesi yang valid.

Saat pindah domain/teknologi, pengguna perlu login satu kali lagi. Setelah itu
refresh tetap mempertahankan sesi selama Supabase menerima refresh token dan
cookie masih berlaku (maksimum cookie 30 hari, diperbarui ketika sesi diperbarui).
Perubahan password meningkatkan session_version sehingga sesi aplikasi lain
langsung ditolak pada permintaan berikutnya. Menonaktifkan akun juga dicek server.

## 5. Deploy ke Vercel

1. Upload isi folder JASAhub-Supabase ke repository GitHub. GitHub dipakai untuk
   source code, bukan hosting GitHub Pages.
2. Vercel > Add New > Project > import repository.
3. Framework: Other. Root Directory: folder berisi package.json, api, lib, public.
4. Node.js: 24.x. Build Command kosong. Output Directory: public.
5. Tambahkan empat variabel utama bagian 2 ke Environment Variables Vercel.
   Jangan menggunakan prefix NEXT_PUBLIC_ atau VITE_. Jangan unggah .env.
6. Gunakan database Supabase terpisah untuk preview/test jika ingin menguji perubahan
   yang menulis data. NODE_ENV produksi dikelola Vercel; tidak perlu menambahkan
   NODE_ENV=development dari contoh .env ke dashboard Vercel.
7. Deploy. Jika variabel diubah sesudah deploy, lakukan Redeploy.
8. Periksa /api/jasa, /assets/jasahub.js dan /assets/logo.png. Semua harus 200.
   /api/jasa harus JSON dengan ok:true; dua aset lainnya harus JS dan PNG, bukan HTML.
9. Uji login admin/pelanggan dan satu pesanan pada domain Vercel.

## 6. Cache dan kelancaran

- Katalog: Cache-Control public, max-age=0, s-maxage=600, stale-while-revalidate=60.
- Browser: cache katalog 3 menit, seperti versi sebelumnya.
- Pemeriksaan akun berjalan terpisah sehingga katalog tidak menunggu login.
- Transaksi, profil dan admin: private, no-store.
- Admin membaca data baru tanpa cache sesudah menyimpan.
- Gambar: /api/media membaca hanya gambar terdaftar dari bucket privat, lalu
  mengirim byte dengan cache CDN tersendiri. Penggantian gambar memakai ID baru.

Perubahan publik dapat tertunda oleh cache CDN dan browser. Untuk perubahan
mendesak, purge CDN melalui Vercel dan hapus cache browser JASAhub. Jangan
menambahkan timestamp acak ke setiap permintaan katalog karena merusak cache hit.
Periksa x-vercel-cache (MISS/HIT/STALE); beberapa direktif CDN bisa tidak terlihat
pada Cache-Control yang diteruskan Vercel ke browser.

## 7. Transaksi dan hak akses

Server memverifikasi Supabase Auth dan membaca role dari profiles. Role dari
request atau user_metadata tidak dipercaya. Data pelanggan lain tidak dimasukkan
ke snapshot transaksi pelanggan. Hanya admin boleh mengubah status dan katalog.
Harga dan pilihan paket selalu diperiksa ulang dari database saat checkout.

Penulisan memakai compare-and-swap revision dan transaksi Postgres. Bila ada
perubahan lain, server membaca ulang lalu mencoba kembali. Indeks unik pasangan
userId/requestId mencegah pesanan ganda. Baris revisi dikunci hanya selama commit,
bukan selama browser menunggu atau mengunggah gambar. Tidak ada tab lock Sheets.
Edit langsung melalui Table Editor juga memperbarui revision melalui trigger.

Rate limit login/register/pesanan disimpan di database dengan key HMAC, berlaku
lintas instance Vercel. Supabase Auth juga memiliki batasnya sendiri. Ini bukan
jaminan kapasitas tak terbatas; pantau penggunaan plan dan log aplikasi.

Jika unggahan selesai tetapi commit gagal, file dapat tertinggal tanpa referensi.
File tidak dihapus secara agresif saat hasil commit tidak pasti agar file yang
sudah terdaftar tidak terhapus akibat respons jaringan yang hilang.

## 8. Pengujian dan pergantian website

```bash
npm test
npm start
```

Buka http://localhost:3000 untuk pengujian lokal memakai konfigurasi .env.
Tidak ada dependency npm eksternal yang harus diunduh untuk menjalankan API.
Tes lokal memakai mock Supabase, tidak mengubah proyek asli.

Sebelum mengalihkan domain, periksa:

1. Beranda, kartu dua kolom, detail dan dock checkout di 360/390px serta desktop.
2. Sidebar, navigasi bawah, smooth scroll dan font sama dengan versi lama.
3. Login/refresh/logout, profil dan password.
4. Admin: tambah/edit/hapus paket, galeri, kategori dan QRIS.
5. Pelanggan kedua tidak bisa mengakses pesanan akun pertama.
6. Pesanan baru Belum Dibayar; bukti WhatsApp tidak melunaskan otomatis.
7. Admin memverifikasi dana -> Proses Pengerjaan -> Selesai.
8. Link hasil serta semua thumbnail/galeri/QRIS lama terbuka.
9. Total akun, produk dan pesanan sesuai laporan impor.

Setelah semua lulus, arahkan pengunjung/domain ke Vercel. Nonaktifkan kemampuan
menulis pada website/deployment Apps Script lama agar tidak ada dua database aktif.
Simpan source lama sebagai cadangan dan jangan hapus database lama sebelum impor
serta hasil produksi diperiksa.

## Batas verifikasi

Pengujian lokal mencakup validasi bisnis, cookie, pembaruan token, kegagalan koneksi,
retry konflik transaksi, izin admin, cache, path aset, dan kesamaan HTML renderer.
Skema SQL dan RLS disediakan tetapi belum dijalankan pada proyek Supabase nyata.
Koneksi Vercel/Supabase, pelaksanaan impor, kuota, perilaku CDN, dan screenshot
browser nyata perlu diverifikasi setelah kamu mengisi konfigurasi.

## Referensi resmi

- Supabase Auth email/password: https://supabase.com/docs/reference/javascript/auth-signinwithpassword
- Admin create user: https://supabase.com/docs/reference/javascript/auth-admin-createuser
- Auth refresh session: https://supabase.com/docs/reference/javascript/auth-refreshsession
- Database functions: https://supabase.com/docs/guides/database/functions
- Row Level Security: https://supabase.com/docs/guides/database/postgres/row-level-security
- Storage access: https://supabase.com/docs/guides/storage/security/access-control
- Vercel cache: https://vercel.com/docs/caching/cache-control-headers
