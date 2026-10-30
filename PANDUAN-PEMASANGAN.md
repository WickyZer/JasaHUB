# JASAhub Emerald — panduan pembaruan website yang sudah berjalan

Paket ini memperbarui proyek Vercel + Supabase JASAhub terakhir. Ini bukan migrasi ulang. Akun, kata sandi, pesanan, media, QRIS, serta pengaturan lama tetap menggunakan database yang sama.

## 1. Sebelum memasang

1. Unduh ZIP repository GitHub saat ini sebagai cadangan kode.
2. Catat deployment Vercel yang sedang aktif agar bisa digunakan kembali jika diperlukan.
3. Simpan empat Environment Variables Vercel yang sekarang. Jangan mengganti `SESSION_SECRET`, URL proyek, atau key Supabase saat pembaruan ini.
4. Ekstrak `JASAhub-Emerald-Update.zip` ke komputer.
5. Jika repository sudah pernah diedit sendiri setelah paket JASAhub terakhir, bandingkan perubahan terlebih dahulu sebelum mengganti file. Paket ini dibuat dari versi Vercel + Supabase terakhir yang tersedia dalam percakapan.

Tidak perlu membuat proyek Supabase atau repository baru. Jangan menjalankan impor legacy lagi. Jangan mengunggah `.env`, `legacy-export`, atau `reset-passwords.json` ke GitHub.

## 2. Jalankan SQL tambahan terlebih dahulu

1. Buka proyek Supabase yang sudah digunakan website.
2. Buka **SQL Editor → New query**.
3. Buka `supabase/upgrade-emerald.txt` dengan Notepad.
4. Tekan **Ctrl+A → Ctrl+C** di Notepad, lalu tempel seluruh isi ke SQL Editor.
5. Pastikan tidak ada potongan kode yang terseleksi; jalankan seluruh query dengan **Run**.
6. Hasil yang diharapkan: **Success. No rows returned**.

SQL tambahan hanya memperbarui fungsi pembacaan snapshot/katalog dan menambahkan bucket privat `jasahub-files`. Tidak menghapus tabel, akun, pesanan, atau media. File dapat dijalankan ulang jika diperlukan.

**Jangan menjalankan `schema.sql`, `schema-install.sql`, atau installer lama untuk pembaruan ini.** File tersebut tetap disertakan sebagai sumber instalasi awal, bukan langkah upgrade.

Setelah sukses, buka Storage. Bucket lama `jasahub-media` tetap ada; bucket baru `jasahub-files` harus berstatus **Private**, bukan Public. Jangan menambahkan policy akses publik ke bucket baru.

Opsional: jalankan `supabase/verify-emerald.sql`. `private_files` harus `true`, sedangkan izin fungsi untuk anon/authenticated harus `false`.

## 3. Perbarui kode repository GitHub

Cara mudah melalui browser GitHub:

1. Buka repository yang sudah terhubung ke Vercel.
2. Pilih **Add file → Upload files**.
3. Buka folder hasil ekstraksi `JASAhub-Emerald` di komputer.
4. Unggah **isi folder tersebut**, bukan ZIP dan bukan satu folder pembungkus tambahan.
5. Pastikan di root repository tetap terlihat `api`, `lib`, `public`, `supabase`, `package.json`, dan `vercel.json`.
6. Isi pesan commit: `Update JASAhub Emerald UI and order features`.
7. Commit ke branch produksi yang biasa digunakan.

Jika GitHub menyatakan ada file yang tidak berhasil diunggah, periksa satu per satu sebelum commit. File lama dengan path sama harus diganti oleh versi terbaru.

File yang harus baru/berubah:

| Lokasi | Perubahan |
| --- | --- |
| `public/index.html` | Memuat tema dan tampilan baru |
| `public/assets/jasahub.js` | Penyesuaian renderer lama dan integrasi upgrade |
| `public/assets/emerald.js` | Halaman dan interaksi fitur baru |
| `public/assets/emerald.css` | Tema putih–slate–emerald dan responsif |
| `lib/engine.js` | Integrasi perhitungan dan data fitur |
| `lib/features.js` | Promo, kebutuhan, tambahan, combo, progres, revisi, ulasan |
| `lib/private-files.js` | Unggah/unduh berkas privat |
| `api/rpc.js` | Aksi backend tambahan |
| `api/media.js` | Menolak berkas privat dari endpoint gambar publik |
| `api/file.js` | Unduhan terautentikasi untuk lampiran/hasil |
| `scripts/dev.js` | Dukungan endpoint baru untuk pengembangan lokal |
| `supabase/upgrade-emerald.*` | SQL pembaruan database |

Folder `tests`, dokumentasi, dan konfigurasi ikut disertakan. Tidak ada dependensi npm baru yang wajib dipasang.

## 4. Tunggu deployment Vercel

Jika integrasi Git masih aktif, commit ke branch produksi memicu deployment baru. Periksa **Vercel → proyek JASAhub → Deployments** sampai status **Ready**.

Pengaturan tetap:

| Pengaturan | Nilai |
| --- | --- |
| Framework | Other |
| Root Directory | Folder yang berisi package.json, biasanya ./ |
| Output Directory | public |
| Build Command | Kosong |
| Node.js | 24.x |

Empat Environment Variables tetap sama: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SESSION_SECRET`. Tidak diperlukan key baru.

Jika deployment otomatis tidak berjalan, periksa branch produksi dan integrasi Git, lalu pilih Redeploy pada proyek yang benar.

## 5. Pemeriksaan sesudah pemasangan

1. Buka website lalu tekan **Ctrl+Shift+R**.
2. Pastikan tema putih–emerald tampil dan thumbnail layanan lama tetap ada.
3. Buka `/api/jasa`; respons harus berisi `"ok": true`.
4. Coba login akun lama, refresh, dan pastikan sesi tetap ada.
5. Periksa layanan, paket, preview, QRIS, serta pesanan lama dari dashboard admin.
6. Buka katalog di HP: kartu horizontal, gambar kiri 16:9, informasi kanan, dan navigasi bawah.
7. Buka detail jasa: pilih paket dan pastikan lingkup paket terlihat; tombol checkout bawah tidak menutup navigasi.
8. Jalankan satu pesanan uji yang kamu kenali, tanpa mengubah pesanan pelanggan yang sedang berjalan. Periksa kebutuhan, total, QRIS, verifikasi manual, timeline, hasil, dan revisi.
9. Coba dua akun berbeda untuk memastikan akun kedua tidak dapat melihat atau mengunduh berkas akun pertama.

Katalog publik memakai cache CDN 10 menit. Perubahan dari admin dapat memerlukan hingga sekitar 10 menit untuk terlihat bagi pengunjung. Harga, promo, kuota, serta kepemilikan selalu diperiksa ulang di backend saat checkout; total yang berubah akan ditolak dan perlu diperiksa ulang.

## 6. Menggunakan fitur baru

### Form kebutuhan dan paket tambahan

Buka **Admin → Tambahan & Combo → Atur** pada jasa yang diinginkan.

- Tambahkan pertanyaan khusus; tandai wajib jika perlu.
- Tambahkan opsi dengan harga, tambahan hari, dan tambahan revisi.
- Simpan pengaturan layanan.
- Pelanggan akan melihat opsi tambahan pada detail jasa dan pertanyaan pada checkout.

Instruksi, deadline, tautan bahan, dan lampiran sudah tersedia tanpa membuat pertanyaan tambahan.

### Paket combo

1. Buat atau gunakan layanan terpisah untuk produk combo, misalnya “Combo T1 + T2”.
2. Atur harga, estimasi, revisi, dan lingkup paket melalui **Layanan → Edit**.
3. Buka **Tambahan & Combo → Atur** untuk produk combo tersebut.
4. Pilih minimal dua layanan aktif sebagai isi combo, lalu simpan.

Harga combo mengikuti paket produk combo, bukan penjumlahan ulang paket komponen. Pelanggan membuat satu pesanan combo. Daftar komponen disalin ke pesanan agar riwayat tetap jelas jika katalog kemudian berubah.

### Promo

Buka **Admin → Promo → Buat Promo**.

Atur kode, nominal/persentase, periode, minimum belanja, maksimum diskon, batas total, batas per akun, serta jasa yang berlaku. Jangan pilih jasa jika promo berlaku untuk semua jasa. Edit lalu hilangkan centang aktif untuk menonaktifkan promo.

Pemakaian terhitung saat pesanan dibuat, termasuk pesanan belum dibayar. Diskon tidak mengubah harga pesanan lama. Total akhir minimal Rp1.000. Promo tidak ditampilkan secara otomatis sebagai banner publik; admin dapat membagikan kode atau menuliskannya dalam deskripsi penawaran.

### Timeline dan verifikasi pembayaran

Buka **Admin → Pesanan → Buka Detail**.

- Setelah bukti dan dana diperiksa, pilih **Proses Pengerjaan**, centang verifikasi, lalu simpan.
- Perubahan status tercatat dalam timeline.
- Isi catatan di **Tambah Catatan Progres** untuk pembaruan manual.
- Tetap hanya ada tiga status: Belum Dibayar, Proses Pengerjaan, Selesai.

Membuka WhatsApp atau mengirim bukti tidak otomatis mengubah status pembayaran.

### Hasil pekerjaan dan revisi

Pada detail pesanan admin:

- Pilih Preview atau Final, lalu unggah berkas.
- File tampil pada detail pesanan pelanggan dengan tombol unduh.
- Untuk file lebih besar, isi tautan hasil HTTPS yang sudah tersedia.
- Pelanggan dapat meminta revisi ketika hasil sudah dibagikan pada status Proses Pengerjaan.
- Setiap pengajuan mengurangi satu kuota revisi.
- Admin dapat menandai pengajuan sebagai ditangani.
- Admin mengubah status menjadi Selesai setelah pekerjaan diselesaikan.

Batas unggahan: 1,5 MB per file, maksimal 5 lampiran kebutuhan dan 20 file hasil per pesanan. Format: PDF, PNG, JPG, WebP, ZIP, DOCX, XLSX, PPTX. Arsip berukuran besar dapat dibagikan melalui tautan dengan izin akses yang sesuai.

Bucket berkas privat terpisah dari gambar katalog. Endpoint unduh memeriksa sesi serta kepemilikan pesanan. File tidak dipublikasikan sebagai gambar katalog. Tidak ada pratinjau isi dokumen atau pemindaian malware otomatis pada versi ini; penerima tetap mengunduh berkas untuk membukanya.

### Ulasan

Pelanggan menekan **Lihat Detail → Beri Ulasan** pada pesanan selesai. Satu ulasan per pesanan. Nama depan, rating, dan teks tampil publik pada detail jasa.

Admin membuka **Ulasan** untuk menyembunyikan atau menampilkan ulasan. Admin tidak mengubah isi ulasan atau membuat rating buatan.

### Ringkasan bisnis

Buka **Admin → Ringkasan** untuk melihat pembayaran perlu verifikasi, pesanan dalam pengerjaan, total nominal terverifikasi, pesanan selesai, permintaan revisi, dan jasa paling banyak dipesan berdasarkan pembayaran terverifikasi.

Pendapatan terverifikasi adalah total nilai pesanan terverifikasi; belum menghitung biaya, laba, ataupun pengembalian dana.

## 7. Jika terjadi masalah

| Gejala | Periksa |
| --- | --- |
| Website belum berubah | Commit di branch yang benar, deployment Ready, lalu Ctrl+Shift+R |
| Tampilan kehilangan style | Pastikan emerald.css dan emerald.js ada di public/assets dan index.html ikut diperbarui |
| SQL error | Jalankan seluruh upgrade-emerald.txt pada New query tanpa memilih potongan kode |
| Unggahan privat gagal | SQL upgrade sudah dijalankan, bucket jasahub-files Private tersedia, format/ukuran sesuai |
| API error setelah upgrade | Periksa empat environment variables dan log Vercel; jangan kirim key ke chat |
| Katalog belum menampilkan perubahan | Tunggu cache hingga sekitar 10 menit; admin memakai data terbaru |
| Pesanan lama tidak punya timeline rinci | Normal; tanggal pembuatan/verifikasi/selesai ditampilkan jika tersedia. Catatan baru mulai tersimpan sesudah upgrade |

Jika perlu kembali ke tampilan lama, gunakan deployment Vercel sebelumnya atau revert commit GitHub. SQL upgrade bersifat tambahan dan dapat tetap berada di database. Jangan menghapus bucket baru jika sudah berisi berkas pesanan.

## Validasi paket

32 pengujian lokal lulus untuk backend, sesi, konflik transaksi, promo, kebutuhan, tambahan, combo, revisi, ulasan, dan akses berkas privat. Browser diperiksa pada desktop dan iframe mobile 390 px dengan data simulasi. Tidak ditemukan overflow horizontal pada tampilan mobile yang diperiksa.

SQL upgrade belum dieksekusi pada proyek Supabase asli. Deployment Vercel dan unggahan Supabase Storage nyata belum diuji karena kredensial tidak tersedia. Website produksi belum diubah langsung.

Referensi resmi: https://vercel.com/docs/git dan https://supabase.com/docs/guides/storage/buckets/fundamentals.
