# JASAhub Emerald + PWA

Baca **PANDUAN-PWA-SIDEBAR.md** untuk pemasangan versi terbaru.

1. Jalankan supabase/upgrade-pwa.txt pada proyek Supabase yang sama.
2. Unggah isi folder proyek ke root repository GitHub yang sudah terhubung ke Vercel.
3. Tunggu deployment Ready; muat ulang website HTTPS.

Tidak perlu impor ulang atau environment variable baru. Paket ini mencakup seluruh fitur Emerald sebelumnya, perbaikan sidebar, logo baru, PWA, serta penghapusan pesanan admin dengan dua konfirmasi.

Panduan lama PANDUAN-PEMASANGAN.md tetap dapat dipakai untuk mempelajari fitur Emerald, tetapi gunakan upgrade-pwa.txt sebagai SQL terbaru, bukan upgrade-emerald.txt.

Node.js 24.x: npm start untuk lokal, npm test untuk pengujian.

Instalasi benar-benar baru: jalankan schema-install.sql, kemudian upgrade-pwa.sql. Pengguna website yang sudah berjalan cukup menjalankan upgrade-pwa.sql.
