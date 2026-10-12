# Devitads Agency — Panduan instalasi

Website ini dibuat sebagai landing page modern yang terinspirasi dari struktur website agency yang kamu kirim, bukan salinan aset/logo milik website tersebut. Tema: cream, charcoal, dan pink lembut; responsif untuk HP.

## Isi ZIP
- `index.html`: website publik.
- `admin.html` / `/admin`: panel admin.
- `assets/`: CSS dan JavaScript.
- `functions/api/content.js`: API untuk membaca/menyimpan konten.
- `schema.sql`: tabel database.
- `wrangler.toml`: konfigurasi Cloudflare Pages + D1.

## Penting: agar panel admin benar-benar menyimpan perubahan untuk semua pengunjung
Panel admin menggunakan Cloudflare Pages Functions dan database D1. Jangan hanya mengunggah ZIP melalui metode drag-and-drop: Cloudflare menyatakan folder `functions` tidak dikompilasi dengan drag-and-drop dashboard. Gunakan Git integration (direkomendasikan) atau Wrangler CLI.

## Cara setup dari HP/komputer (disarankan: GitHub + Cloudflare)
1. Ekstrak ZIP ini.
2. Buat repository baru di https://github.com/new dan unggah semua file/folder ZIP yang sudah diekstrak ke repository. Pastikan `index.html`, `wrangler.toml`, `schema.sql`, dan folder `functions` berada di root repository.
3. Buka https://dash.cloudflare.com/ lalu masuk ke **Workers & Pages** → **Create** → **Pages** → **Connect to Git**. Hubungkan repository tadi.
4. Untuk project ini, gunakan build command `exit 0` dan build output directory `.` jika form memintanya. Deploy.
5. Di Cloudflare, buka **Workers & Pages** → **D1 SQL Database** → **Create database**. Nama: `devitads-agency-db`.
6. Buka database D1 → **Console** dan jalankan isi file `schema.sql` (copy-paste seluruh SQL).
7. Buka D1 database **Settings** atau halaman overview, salin Database ID.
8. Di repository GitHub, edit `wrangler.toml`: ganti `REPLACE_WITH_YOUR_D1_DATABASE_ID` dengan ID D1 milikmu, lalu commit perubahan.
9. Di Cloudflare Pages project → **Settings** → **Bindings** → **Add** → **D1 database**. Variable name harus `DB`, pilih database `devitads-agency-db`, simpan.
10. Di Pages project → **Settings** → **Variables and Secrets** (atau bagian Environment variables), tambahkan secret `ADMIN_PASSWORD` dengan password unik yang panjang. Jangan tulis password ini di file website atau kirim ke orang lain.
11. Redeploy project dari tab **Deployments** agar binding dan secret aktif.
12. Buka URL `https://NAMA-PROJECT.pages.dev/admin`, masukkan password tadi, edit konten lalu klik **Simpan perubahan**.

## Catatan
- Nama URL `NAMA-PROJECT.pages.dev` dipilih saat membuat project dan harus tersedia.
- Jangan memakai password yang sama dengan akun lain. Gunakan HTTPS dan jaga akses akun Cloudflare/GitHub.
- Jangan hapus tabel D1 karena semua konten tersimpan di situ.
- Untuk edit daftar peluang, benefit, paket, dan FAQ, buka bagian JSON di panel admin. JSON harus valid.
- Jika API memberi pesan database belum siap, periksa binding D1 bernama tepat `DB`, jalankan `schema.sql`, lalu redeploy.
- Google Fonts memerlukan koneksi internet; bila tidak tersedia, website memakai font cadangan.

## Modul pembayaran GoMerch (adapter awal, wajib diuji sebelum live)

ZIP ini sekarang menyertakan tabel `products`, `stock_items`, `orders` serta endpoint adapter:
- `POST /api/payment-create` — membuat pesanan QRIS dari produk aktif di tabel `products`.
- `GET /api/payment-status?order_id=...` — menampilkan status pesanan dari database.

**Penting: ini belum merupakan integrasi produksi yang selesai.** API Explorer yang kamu kirim mendokumentasikan `GET /api/qris/create?amount=...&static_qr=...` dan `GET /api/history/auto/:apikey`, tetapi bentuk respons aktual akunmu belum diuji. Endpoint status sengaja tidak mengubah pesanan menjadi lunas atau membuka stok otomatis sebelum format mutasi dan penanda transaksi masuk dipastikan, supaya pelanggan tidak mendapat akun hanya karena respons API yang salah dibaca.

### Variabel Cloudflare yang diperlukan
Di Pages → Settings → Variables and Secrets, tambahkan:
- `GOMERCH_BASE_URL` = `https://brann-merchant-production.up.railway.app`
- `GOMERCH_API_KEY` = API key GoMerch kamu (secret, jangan di frontend/GitHub)
- `GOMERCH_STATIC_QR` = **teks payload QRIS mentah**, bukan gambar QRIS

Endpoint create memakai header `X-API-Key` untuk key. Jika dokumentasi akunmu meminta key pada path atau parameter lain, sesuaikan adapter dengan dokumentasi aktual. Jangan menganggap key yang ada pada URL riwayat otomatis juga berwenang membuat QRIS.

### Menyiapkan produk/stok
Jalankan `schema.sql` di D1 Console setelah membuat database. Tambahkan produk melalui D1 Console terlebih dahulu, misalnya:
`INSERT INTO products (name,description,price,active) VALUES ('Canva Premium','Akses sesuai deskripsi produk',6000,1);`
Tambahkan stok satu per baris, dengan `product_id` sesuai produk:
`INSERT INTO stock_items (product_id,payload) VALUES (1,'Detail akun yang akan dikirim');`
Jangan memasukkan stok nyata sebelum memastikan akses database dan panel admin aman.

### Sebelum penjualan sungguhan
1. Tes pembuatan QRIS dengan nominal kecil dan pastikan respons `qr_string` cocok.
2. Catat contoh respons mutasi yang sudah menghapus data pribadi/token; cocokkan nama field nominal, waktu, tipe transaksi, dan referensi.
3. Lengkapi verifikasi transaksi idempoten dan penguncian stok di server; baru setelah itu status boleh berubah menjadi `paid` dan stok dikirim ke halaman pesanan.
4. Tambahkan autentikasi admin untuk semua operasi produk/stok/pesanan. Jangan membuka endpoint pengelolaan stok ke publik.

Saat ini panel `/admin` mengedit konten landing page; panel tersebut **belum** menjadi dashboard manajemen produk, stok, atau transaksi. Fitur pembayaran dan pengiriman akun otomatis belum siap dipakai untuk pelanggan sampai langkah verifikasi di atas diselesaikan.
