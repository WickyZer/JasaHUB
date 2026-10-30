# JASAhub Emerald

Pembaruan untuk website JASAhub Vercel + Supabase yang sudah berjalan.

Baca **PANDUAN-PEMASANGAN.md** untuk langkah pemasangan, SQL upgrade, penggunaan fitur, dan pemeriksaan.

1. Jalankan `supabase/upgrade-emerald.sql` pada proyek Supabase yang sama.
2. Perbarui isi repository GitHub dengan isi folder ini.
3. Tunggu Vercel Ready, lalu uji menggunakan akun lama.

Tidak ada impor ulang data dan tidak ada environment variable baru.

## Menjalankan secara lokal

Node.js 24.x, isi `.env` secara privat sesuai `.env.example`.

```sh
npm start
npm test
```

Endpoint produksi: `/api/jasa`, `/api/rpc`, `/api/media`, `/api/file`.

Fitur: tema putih–slate–emerald, katalog responsif, form kebutuhan, lampiran privat, tambahan paket, combo, promo, timeline, hasil pekerjaan, revisi, ulasan, dan ringkasan admin.

Pengujian browser memakai data simulasi; tidak ada mode demo atau akun uji otomatis pada website produksi. Tidak ada data pelanggan atau kredensial dalam paket ini.

Untuk instalasi benar-benar baru, jalankan installer awal `supabase/schema-install.sql`, kemudian `supabase/upgrade-emerald.sql`. Untuk pengguna website yang sudah berjalan, cukup jalankan SQL upgrade. Akun admin dibuat menggunakan script `scripts/create-admin.js` sesuai variabelnya; tidak ada akun atau password admin bawaan.
