# Pembaruan JASAhub: sidebar, logo, PWA, dan hapus pesanan

Paket lengkap ini melanjutkan JASAhub Emerald sebelumnya. Semua delapan fitur sebelumnya tetap disertakan. Website produksi belum diperbarui langsung.

## Urutan pemasangan

1. Cadangkan repository GitHub saat ini dengan Download ZIP dan catat deployment Vercel aktif.
2. Unduh lalu ekstrak paket `JASAhub-Emerald-PWA.zip`.
3. Buka proyek Supabase yang sama → **SQL Editor → New query**.
4. Buka `supabase/upgrade-pwa.txt` menggunakan Notepad. Salin seluruh isi lalu jalankan di SQL Editor tanpa menyeleksi sebagian kode. Hasil: **Success. No rows returned**.
5. Unggah seluruh **isi folder `JASAhub-Emerald-PWA`** ke root repository GitHub yang sama. Jangan mengunggah ZIP atau folder pembungkus tambahan. Folder api, lib, public, dan package.json harus tetap di root.
6. Commit, kemudian tunggu Vercel → Deployments berstatus **Ready**.
7. Buka website melalui domain HTTPS Vercel dan tekan **Ctrl+Shift+R**.
8. Periksa tombol sidebar pada beranda desktop, katalog, halaman akun, serta HP. Klik ulang tombol untuk menutupnya.
9. Periksa logo gambar pertama pada header, sidebar, dan footer. Logo gambar kedua digunakan pada favicon/tab browser serta aplikasi terpasang.

Tidak perlu environment variable baru, impor ulang data, atau proyek baru. Pertahankan empat environment variable lama, terutama SESSION_SECRET.

**Gunakan hanya upgrade-pwa.txt untuk pembaruan ini**, termasuk jika SQL Emerald sebelumnya sudah dijalankan. SQL tersebut dapat dijalankan ulang dan juga mencakup kebutuhan upgrade Emerald. Jangan menjalankan ulang installer atau impor legacy.

SQL memperbarui snapshot/katalog agar pesanan yang dihapus tidak ikut hitungan publik dan penggunaan promo. Bucket privat yang diperlukan Emerald tetap dibuat bila belum tersedia. Tidak ada tabel atau data lama yang dihapus.

## Memasang menjadi aplikasi

Tombol pemasangan berbentuk ikon unduh pada header dan bertuliskan **Pasang Aplikasi** pada sidebar/footer.

### Android — Chrome

1. Buka domain website HTTPS di Chrome, menggunakan tab biasa.
2. Tekan tombol Pasang Aplikasi.
3. Jika dialog instalasi tersedia, konfirmasikan Instal/Pasang.
4. Jika yang muncul panduan, gunakan menu Chrome → Instal aplikasi atau Tambahkan ke layar utama. Nama menu dapat berbeda menurut perangkat.

### Komputer — Chrome atau Edge

1. Buka website melalui HTTPS.
2. Tekan Pasang Aplikasi, atau ikon instalasi/menu Apps pada browser.
3. Konfirmasikan pemasangan. Aplikasi dapat dibuka sebagai jendela tersendiri.

### iPhone/iPad — Safari

Buka website di Safari → Bagikan/Share → Tambahkan ke Layar Utama/Add to Home Screen → Tambah. Dialog instalasi otomatis seperti Android tidak tersedia melalui event yang sama pada iOS.

Aplikasi ini adalah PWA, bukan file APK atau aplikasi Play Store. Pemasangan mengikuti dukungan browser dan perangkat. Browser privat atau browser dalam WhatsApp/Instagram dapat membatasi pemasangan; buka di browser utama.

Login, katalog terbaru, checkout, QRIS, serta data pesanan memerlukan internet. Ketika halaman tidak dapat dimuat karena offline, aplikasi menampilkan halaman pemberitahuan dan tombol Coba Lagi. Service worker tidak menyimpan respons API, sesi, dokumen pelanggan, atau hasil pekerjaan dalam Cache Storage; cache katalog publik yang sudah ada tetap digunakan oleh frontend.

Logo berasal dari gambar yang diberikan, dengan ukuran turunan untuk header, favicon, apple-touch-icon, serta ikon PWA 192/512 px dan maskable. Bentuk logo tidak diregangkan. Logo bawaan baru menggantikan logo pengaturan versi lama; admin tetap dapat mengunggah pengganti melalui Pengaturan, lalu Simpan.

Jika aplikasi sudah terpasang sebelum pergantian ikon, sistem operasi dapat membutuhkan waktu untuk memperbaruinya. Jika ikon lama terus muncul, tutup aplikasi, buka website lagi, atau hapus pemasangan lalu pasang ulang setelah memastikan kamu masih mengetahui akun login.

## Hapus pesanan admin — dua konfirmasi

1. Login sebagai admin → Pesanan.
2. Tekan **Hapus Pesanan** pada kartu pesanan, atau buka detail lalu bagian Hapus Pesanan.
3. **Konfirmasi 1 dari 2** menampilkan ID, nama layanan, status, dan nilai pesanan. Tekan **Ya, Lanjutkan Verifikasi**.
4. **Konfirmasi 2 dari 2** menampilkan ringkasan dan peringatan terakhir. Tekan **Konfirmasi Hapus Pesanan**.
5. Pesanan hilang dari daftar pelanggan/admin, statistik aktif, ulasan publik, dan hitungan promo. Tampilan katalog publik mengikuti masa cache hingga sekitar 10 menit.

Batal atau menutup dialog pada tahap mana pun tidak menghapus pesanan. Tiket konfirmasi berlaku lima menit, terikat pada akun admin dan versi pesanan. Jika pesanan berubah di sela konfirmasi, ulangi proses.

Penghapusan menggunakan arsip internal (soft delete): salinan data tetap berada pada tabel orders dengan deletedAt/deletedBy. Berkas tidak dihapus dari Storage dan tidak ada pengembalian dana otomatis. Pelanggan tidak dapat mengunduh berkas dari pesanan yang sudah dihapus; admin tetap memiliki akses administratif. Belum ada tombol pemulihan pada dashboard. Data dapat dipulihkan oleh pengelola database dengan menghapus properti deletedAt/deletedBy pada JSON data pesanan tersebut, lalu menunggu cache katalog diperbarui.

## File penting dalam pembaruan

- public/assets/pwa.js — sidebar, pemasangan aplikasi, dua dialog konfirmasi.
- public/assets/logo-website.png — logo website.
- public/assets/icons/ dan public/favicon.ico — ikon aplikasi/tab.
- public/manifest.webmanifest — identitas PWA.
- public/sw.js dan public/offline.html — service worker dan fallback offline.
- public/index.html dan public/assets/emerald.css — integrasi dan tampilan.
- public/assets/emerald.js — urutan startup yang diperbarui.
- lib/order-deletion.js, lib/features.js, lib/engine.js, api/rpc.js, api/file.js — arsip pesanan, pemeriksaan admin, tiket, akses berkas.
- supabase/upgrade-pwa.txt — SQL terbaru.
- vercel.json — header manifest dan pembaruan service worker.

Unggah seluruh paket untuk menghindari file pendukung tertinggal. Jangan unggah .env, legacy-export, atau reset-passwords.json.

## Verifikasi

36 pengujian lokal lulus, termasuk penolakan hapus oleh pelanggan, konfirmasi palsu/kedaluwarsa, perubahan pesanan di sela konfirmasi, arsip data, ikon manifest, serta regresi fitur lama. Browser desktop diuji dengan data simulasi untuk sidebar, logo, panduan pemasangan, dan dua tahap hapus sampai pesanan hilang dari daftar. Layout mobile diperiksa melalui iframe lebar 390 px.

Pemasangan PWA pada perangkat nyata dan service worker pada domain HTTPS produksi belum diuji. SQL belum dijalankan pada proyek Supabase asli. Setelah deploy, uji menggunakan akun dan pesanan uji milikmu.

Referensi resmi: https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable dan https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/How_to/Trigger_install_prompt.
