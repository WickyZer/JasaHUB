# Pembaruan JASAhub: admin penjual, katalog unggulan, dan animasi

Kode diperbarui melalui GitHub dan deployment Vercel yang sudah terhubung. Tidak perlu menambahkan environment variable atau membuat website baru.

## 1. Aktifkan dukungan database satu kali

1. Buka project Supabase JASAhub → **SQL Editor** → **New query**.
2. Di GitHub, buka `supabase/upgrade-sellers.sql` → **Raw**. Salin **seluruh** isi file, dari `begin;` hingga `commit;`, termasuk komentar sebelumnya.
3. Tempel ke query baru dan tekan **Run**. Jangan hanya menjalankan potongan yang terseleksi.
4. Jika berhasil, muat ulang website setelah deployment Vercel berstatus **Ready**.

File ini untuk website yang sebelumnya sudah memakai versi Emerald/PWA. File dapat dijalankan ulang dan tidak menghapus produk, akun, pesanan, atau berkas. Jangan menjalankan ulang upgrade Emerald/PWA lama setelah upgrade ini karena fungsi snapshot lama akan menggantikan pemisahan penjual. Untuk instalasi dari nol: jalankan schema-install.sql, upgrade-pwa.sql, lalu upgrade-sellers.sql sesuai urutan.

Kode tetap kompatibel dengan akun pemilik dan produk lama sebelum migrasi. Penambahan akun penjual memerlukan SQL ini. Saya tidak menjalankan migrasi pada database produksi; langkah SQL dilakukan oleh pemilik project Supabase.

## 2. Tambahkan rekan sebagai admin penjual

1. Minta rekan **Daftar** sendiri di JASAhub menggunakan nomor WhatsApp mereka.
2. Masuk dengan akun admin pemilik lama → **Dashboard Admin → Admin Penjual**.
3. Masukkan nomor WhatsApp rekan → **Cari Akun**.
4. Periksa nama dan nomor yang ditampilkan → **Konfirmasi Tambah Admin**.
5. Minta rekan masuk kembali karena perubahan akses mengakhiri sesi sebelumnya.

Akun admin lama tetap berperan sebagai **pemilik website**. Penjual baru memakai peran `seller`, bukan `admin`. Tombol ini tidak memberikan akses Supabase, GitHub, atau Vercel.

## 3. Rekan menyiapkan lapak jasanya

1. Rekan membuka **Dashboard Admin → Profil & Pembayaran**.
2. Isi nama penjual/usaha, nomor WhatsApp, instruksi pembayaran, dan unggah QRIS asli, lalu simpan.
3. Buka **Layanan → Tambah Jasa**, isi paket, harga, estimasi, lingkup, dan gambar, lalu terbitkan.
4. Rekan hanya melihat produk miliknya, pesanan untuk produknya, pelanggan terkait pesanan tersebut, serta laporan pendapatannya sendiri.
5. Untuk pesanannya, rekan dapat memverifikasi pembayaran, memperbarui progres, mengunggah hasil, menangani revisi, dan menghapus pesanan melalui dua tahap konfirmasi.

Kategori, promo global, pemilihan produk unggulan, pengaturan website, dan penambahan/pencabutan admin penjual tetap menjadi wewenang pemilik. Produk dan pesanan lama tetap dikelola pemilik; tidak otomatis dibagikan ke rekan baru. Pemilik tetap dapat mengelola seluruh produk/pesanan.

QRIS dan WhatsApp mengikuti penjual produk. Detail penerima disimpan ketika pesanan dibuat, sehingga perubahan QRIS setelahnya tidak mengganti penerima untuk pesanan lama. Pesanan lama sebelum pembaruan tetap menggunakan pembayaran website. Tidak ada pembagian komisi, pencairan otomatis, ataupun rekening penampungan baru.

## 4. Pilih produk unggulan

Pemilik membuka **Layanan → Edit → Pilihan JASAhub** dan menyimpan produk. Produk tersebut muncul dalam **Jasa Unggulan**, di atas daftar produk lainnya, pada beranda dan katalog. Filter pencarian, kategori, harga, estimasi, serta pengurutan berlaku pada keduanya; kartu tidak digandakan dalam daftar biasa. Penjual tidak dapat menentukan sendiri status unggulan.

Katalog publik menggunakan cache yang sudah ada, sehingga perubahan publik dapat membutuhkan beberapa menit. Perubahan harga, akses, dan ketersediaan tetap divalidasi ulang di server saat checkout.

## 5. Animasi scroll

Kartu dan beberapa blok publik masuk dengan fade-in serta geseran naik 12px, sekitar 0,5 detik. Setiap konten dianimasikan sekali selama sesi halaman; tidak diulang saat digulir naik lalu turun. Konten yang sudah berada di layar saat halaman dibuka langsung terlihat. Pengaturan **Reduce motion/Kurangi gerakan** menonaktifkan efek, dan navigasi keyboard tetap menampilkan elemen yang mendapat fokus.

## 6. Cabut akses rekan

Buka **Admin Penjual → Cabut Akses Penjual**, periksa akun, lalu konfirmasikan. Sesi rekan berakhir dan mereka kembali menjadi pelanggan. Produk mereka tidak dapat dipesan; kartu yang tersimpan di cache mungkin masih terlihat sementara. Data dan pesanan tidak dihapus, serta pemilik tetap dapat menyelesaikan pesanan aktif. Penambahan kembali akun penjual menggunakan alur yang sama.
