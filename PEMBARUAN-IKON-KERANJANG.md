# Pembaruan ikon dan keranjang JASAhub

## Ikon native SVG

Seluruh 16 ikon referensi dibuat ulang dengan bentuk dan path vector, ditambah ikon keranjang. File terpisah berada di `public/icons/`: home, catalog, featured, orders, account, search, filter, checkout, chat, qris, upload-proof, download-result, admin, statistics, notification, settings, dan cart.

Palet menggunakan slate #1E293B, emerald #10B981, dan mint #34D399, dengan sudut rounded, gradient lembut, dan lapisan glass. Total 17 file sekitar 16 KB. Tidak ada raster, base64, sumber eksternal, atau filter berat. ViewBox konsisten 64×64; ukuran kontrol mengikuti layout yang sudah ada. Hover menggunakan scale kecil dan menghormati preferensi reduced motion.

`public/assets/icons.js` menyediakan renderer inline reusable dengan ID gradient unik per instance. Ubah SVG sumber, lalu jalankan `npm run build:icons` untuk memperbarui renderer. Ikon notifikasi tersedia sebagai aset; tidak dibuat fitur notifikasi baru hanya untuk menempatkannya. Ikon panah dan kontrol lain di luar referensi tetap menggunakan sistem sebelumnya.

## Alur keranjang

1. Buka detail jasa, pilih paket dan tambahan, lalu tekan **Tambah ke Keranjang**. Keranjang dapat memuat maksimal 10 pilihan jasa. Pilihan disimpan di perangkat; brief dan data pribadi tidak disimpan di localStorage.
2. Buka tombol keranjang di header atau sidebar. Pengguna dapat menghapus item, melihat detail, atau menambah jasa lain. Login diperlukan sebelum checkout.
3. Lengkapi brief, pertanyaan wajib, deadline, tautan materi HTTPS, catatan, dan kode promo untuk masing-masing jasa. Checkout keranjang menggunakan tautan materi; upload file pada checkout satu jasa tetap tersedia.
4. Tekan **Periksa Harga**. Server memvalidasi harga, paket, penjual aktif, promo, dan seluruh detail pesanan. Perubahan formulir memerlukan pemeriksaan harga ulang.
5. Buat semua pesanan dalam satu transaksi. Jika satu item tidak valid, seluruh batch dibatalkan. ID permintaan dan ID item mencegah pesanan ganda saat permintaan diulang atau koneksi terputus.
6. Pembayaran ditampilkan per penjual dan rekening/QRIS yang tersimpan pada pesanan. Satu kelompok menampilkan seluruh ID pesanan dan total yang harus dibayar kepada penjual tersebut. Pembayaran antarpenjual tetap terpisah.
7. Tombol WhatsApp menyiapkan pesan berisi ID pesanan dan total kelompok. Pengguna melampirkan bukti secara manual. Membuka WhatsApp tidak menandai pembayaran sebagai lunas.
8. Dari **Pesanan Saya**, pengguna dapat membuka kembali pembayaran keranjang untuk pesanan yang belum dibayar. Admin melihat kelompok checkout dan tautan pesanan terkait dalam lingkup penjualnya sendiri; verifikasi dan perubahan status tetap dilakukan per pesanan.

Checkout satu jasa, tiga status pesanan, akses terpisah antarpenjual, dan dua tahap konfirmasi penghapusan admin tetap digunakan. Tata letak halaman yang ada dipertahankan; UI tambahan terbatas pada kontrol keranjang, halaman keranjang, formulir batch, dan informasi kelompok pembayaran.

## Penyimpanan dan deployment

Metadata kelompok disimpan pada JSONB pesanan yang sudah ada. Tidak memerlukan migrasi SQL atau pemasangan manual di Supabase. Endpoint baru menggunakan autentikasi, validasi server, pembatasan permintaan, serta transaksi `jh_commit` yang sama dengan pesanan sebelumnya. Cache PWA dinaikkan agar aset baru terambil.

Push ke branch `main` memicu deployment Vercel sesuai integrasi proyek. Pengguna aplikasi PWA yang masih melihat versi lama dapat menutup seluruh jendela aplikasi lalu membukanya kembali setelah deployment selesai.

## Validasi

- `npm test`: 59 pengujian lulus, termasuk 10 pengujian baru untuk SVG, checkout batch, transaksi atomik, idempotensi, promo, harga, dan isolasi penjual.
- Pemeriksaan browser pada desktop dan iframe mobile 390/320 px: tambah jasa, keranjang, ukuran ikon, ringkasan harga, serta tampilan checkout. Tidak ada overflow horizontal pada kedua ukuran mobile yang diperiksa.
- Checkout demo dua jasa dari dua penjual berhasil menghasilkan dua pesanan dan dua kelompok pembayaran dengan total yang sesuai.
- Pengujian browser memakai server dan data demo terisolasi. Tidak membuat pesanan pelanggan di produksi, mengirim WhatsApp, atau melakukan pembayaran nyata. Pengujian perangkat fisik dan transfer QRIS nyata belum dilakukan.
