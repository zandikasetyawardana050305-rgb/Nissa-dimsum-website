NISSA DIMSUM - Siap Deploy ke Vercel

STRUKTUR
 index.html, css/, js/, images/   -> website (statis)
 api/orders.js                    -> backend Vercel (simpan pesanan)
 js/config.js                     -> EDIT nama toko, QRIS, menu & harga

CARA DEPLOY
1. Upload folder ini ke GitHub (repo baru), atau pakai Vercel CLI: `npx vercel`
2. Di vercel.com > Add New > Project > pilih repo > Deploy (tanpa setting khusus).
3. Hubungkan database: di project Vercel buka tab Storage > Marketplace > Upstash (Redis)
   > Create & Connect. Variabel KV_REST_API_URL & KV_REST_API_TOKEN terisi otomatis.
4. Settings > Environment Variables > tambah ADMIN_PASSWORD = (password pilihanmu).
5. Deployments > Redeploy agar variabel aktif.

CARA PAKAI
- Pelanggan: buka website, pilih menu, checkout (Cash/QRIS).
- Admin: klik tab "Daftar Pesanan (Admin)", masukkan ADMIN_PASSWORD.
  Pelanggan tidak bisa melihat daftar pesanan tanpa password.

CATATAN
- Jika index.html dibuka langsung (tanpa Vercel), website otomatis memakai mode lokal.
- Harga di config.js hanyalah contoh, ganti sesuai harga asli.
