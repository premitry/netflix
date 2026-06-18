# ⚡ FLIXVAULT — Bot Netflix Multi-Tenant

Bot Telegram + dashboard web untuk **menjual akses pencarian email Netflix** secara multi-tenant. Tiap **buyer** punya server IMAP sendiri dan mendaftarkan domain miliknya secara manual. End-user cukup mengirim alamat email ke bot untuk mengambil kode/link Netflix.

Berjalan sepenuhnya di **Cloudflare Workers** + **D1** (serverless, tanpa VPS).

> Status: **Tahap 1 (bot inti)** + **Tahap 2 (dashboard web + backup)** — lengkap & siap pakai.
> **Tahap 3** (payment gateway otomatis) belum termasuk; aktivasi masih manual.

---

## 📑 Daftar Isi
1. [Prasyarat](#-prasyarat)
2. [Struktur Proyek](#-struktur-proyek)
3. [Fitur](#-fitur)
4. [Cara Kerja Singkat](#-cara-kerja-singkat)
5. [Cara Deploy](#-cara-deploy)
6. [Set Webhook & Verifikasi](#-set-webhook--verifikasi)
7. [Inisialisasi Pertama](#-inisialisasi-pertama)
8. [Menambah & Setup Buyer](#-menambah--setup-buyer)
9. [Panduan Pemakaian](#-panduan-pemakaian)
10. [Perintah Bot](#-perintah-bot)
11. [Konfigurasi (vars & secrets)](#-konfigurasi-vars--secrets)
12. [Skema Database](#-skema-database)
13. [Backup & Restore](#-backup--restore)
14. [Keamanan](#-keamanan)
15. [Troubleshooting](#-troubleshooting)
16. [Roadmap Tahap 3](#-roadmap-tahap-3)

---

## ✅ Prasyarat
- **Node.js 18+** dan npm.
- **Akun Cloudflare** (gratis sudah cukup; Workers + D1 masuk free tier).
- **Wrangler** (CLI Cloudflare) — sudah masuk `devDependencies`, jalankan via `npx wrangler ...`.
- **Token bot Telegram** dari [@BotFather](https://t.me/BotFather) (`/newbot`).
- **Akun IMAP** untuk tiap buyer (host, port, user, password). Domain-domain Netflix harus terkirim/diteruskan ke inbox IMAP tersebut (mis. catch-all atau forwarding).

---

## 📁 Struktur Proyek
```
netvault-pro/
├─ package.json          # dependensi & script
├─ tsconfig.json         # konfigurasi TypeScript
├─ wrangler.toml         # konfigurasi Worker (binding D1, cron, vars)
├─ schema.sql            # skema tabel D1
├─ .gitignore
├─ README.md
└─ src/
   ├─ index.ts           # entry point: router fetch + cron scheduled()
   ├─ env.ts             # tipe Env (binding & variabel)
   ├─ bot.ts             # logika bot: perintah, wizard, menu, pencarian
   ├─ telegram.ts        # klien Telegram Bot API
   ├─ imap.ts            # klien IMAP (TCP Sockets API Workers)
   ├─ mime.ts            # parser MIME sederhana (header, body, quoted-printable/base64)
   ├─ netflix.ts         # deteksi 5 kategori + ekstraksi kode/link (multi-bahasa)
   ├─ db.ts              # seluruh query D1 (buyer, imap, domain, sesi, backup, dll)
   ├─ auth.ts            # hashing password (PBKDF2) & token sesi
   ├─ backup.ts          # export/import + enkripsi backup AES-GCM
   ├─ web.ts             # routing API + session dashboard
   └─ html.ts            # halaman login & dashboard (dark mode, satu file)
```

---

## ✨ Fitur

### Tahap 1 — Bot inti
- Pencarian **5 kategori** dengan **auto-deteksi bahasa email**:
  | Kategori | Hasil | Akses |
  |---|---|---|
  | 🔑 Kode Masuk | kode **4 digit** | publik |
  | 🏠 Household | link | publik |
  | 📺 Link TV | link | publik |
  | 🔓 Reset Password | link | buyer/admin |
  | 📧 Reset Email | kode **6 digit** | buyer/admin |
- **Multi-tenant**: 1 buyer = 1 IMAP, bisa menampung banyak domain.
- **Routing domain manual** (anti-bentrok antar buyer; 1 domain hanya milik 1 buyer).
- Role **Admin** + **Buyer**, langganan **berbasis waktu** (aktivasi manual).
- **Rate limit** per user (default 10/menit).
- **Branding bisa diganti**: nama bot & teks sambutan diatur sendiri (anti-mirip brand lain), via perintah admin atau dashboard.

### Tahap 2 — Dashboard web + backup
- Dashboard web **dark mode**, login email + password (admin & buyer berbagi backend yang sama).
  - **Buyer**: cari email, atur IMAP, kelola domain.
  - **Admin**: kelola buyer, set login web buyer, backup & restore, pengaturan backup.
- **Backup**:
  - **Otomatis terjadwal** (cron tiap jam; jalan pada jam yang diatur, zona WIB).
  - **Backup perubahan** (toggle; ada opsi hanya backup user aktif).
  - **Restore** via bot (`/restore` + kirim file) maupun via web.
  - **Enkripsi opsional** (AES-GCM) bila `BACKUP_KEY` diisi.

---

## 🧠 Cara Kerja Singkat
1. Telegram mengirim update ke `POST /webhook/<WEBHOOK_SECRET>` di Worker.
2. Worker memverifikasi secret, lalu `bot.ts` memproses pesan/tombol.
3. Saat pencarian: bot mengambil **domain** dari email → mencari pemilik domain di tabel `domains` → memakai **IMAP milik buyer tersebut** → `imap.ts` connect + cari email Netflix → `netflix.ts` mengekstrak kode/link → balas ke user.
4. Dashboard web (`web.ts` + `html.ts`) memakai database & logika yang sama, autentikasi via cookie sesi.
5. `scheduled()` berjalan tiap jam untuk backup otomatis sesuai jam yang diatur.

---

## 🚀 Cara Deploy

```bash
# 0) Masuk ke folder proyek
cd netvault-pro

# 1) Install dependensi
npm install

# 2) Login ke Cloudflare
npx wrangler login

# 3) Buat database D1, lalu SALIN "database_id" yang muncul ke wrangler.toml
#    (ganti nilai database_id = "GANTI_DENGAN_D1_ID")
npx wrangler d1 create netvault-pro

# 4) Buat semua tabel di D1
npx wrangler d1 execute netvault-pro --remote --file=./schema.sql

# 5) Set secret (akan diminta mengetik nilainya)
npx wrangler secret put BOT_TOKEN        # token dari @BotFather
npx wrangler secret put WEBHOOK_SECRET   # string acak panjang, mis. 32+ karakter
npx wrangler secret put BACKUP_KEY       # OPSIONAL (untuk enkripsi backup)

# 6) Deploy
npx wrangler deploy
```

Setelah berhasil kamu akan dapat URL, mis. `https://netvault-pro.<akun>.workers.dev`.

> Catatan: `wrangler.toml` sudah mengaktifkan flag `nodejs_compat` dan cron `"0 * * * *"` (tiap jam). Jangan dihapus.

---

## 🔗 Set Webhook & Verifikasi
Ganti `<TOKEN>`, `<WORKER_URL>`, `<WEBHOOK_SECRET>` lalu buka URL ini di browser:
```
https://api.telegram.org/bot<TOKEN>/setWebhook?url=<WORKER_URL>/webhook/<WEBHOOK_SECRET>&drop_pending_updates=true
```
Harus membalas `{"ok":true,...}`.

**Verifikasi cepat:**
- Buka `<WORKER_URL>/healthz` → harus muncul `FLIXVAULT OK`.
- Cek status webhook: `https://api.telegram.org/bot<TOKEN>/getWebhookInfo`
  - `url` harus tepat = `<WORKER_URL>/webhook/<WEBHOOK_SECRET>`
  - `last_error_message` harus kosong / null

> ⚠️ Nilai pada bagian `url` di `setWebhook` HARUS persis sama dengan secret yang kamu isi di `WEBHOOK_SECRET`. Kalau beda, semua update akan ditolak 403/404.

---

## 🌱 Inisialisasi Pertama
1. Chat bot → kirim `/setadmin` → kamu jadi **admin pertama** (hanya bisa sekali; admin berikutnya lewat database).
2. Kirim `/setweblogin email@kamu.com passwordku` → membuat login dashboard untuk admin.
3. Buka `<WORKER_URL>` → login → mulai kelola buyer / atur IMAP & domain.

---

## 👥 Menambah & Setup Buyer
1. Buyer chat bot → `/start` lalu `/myid` → kirim **Telegram ID**-nya ke admin.
   *(Bot tidak bisa mengirim pesan ke user yang belum pernah `/start`, jadi langkah ini wajib.)*
2. Admin membuat buyer:
   - Lewat **bot**: panel `/admin` → “Tambah Buyer” → isi ID → nama → durasi (hari). Atau cepat: `/grant <id> <hari>`.
   - Lewat **web**: tab **Buyer** → isi Telegram ID, nama, durasi.
3. (Opsional) Admin membuat **login web** untuk buyer:
   - Bot: `/buyerlogin <id> <email> <password>`
   - Web: tab **Buyer** → “Set Login Web Buyer”.
4. Buyer mengatur **IMAP** lalu mendaftarkan **domain** miliknya (lewat bot menu atau dashboard).
5. Selesai — end-user tinggal mengirim email ke bot.

---

## 📖 Panduan Pemakaian

### Untuk end-user (pembeli akses)
1. Kirim alamat email (mis. `user@domainbuyer.com`) ke bot.
2. Pilih kategori dari tombol yang muncul.
3. Bot membalas kode/link. Tombol **Cari Lagi** / **Email Lain** tersedia.

### Untuk buyer
- `/menu` → **Atur IMAP**, **Kelola Domain**, **Tes Koneksi**, **Status**.
- Atau login ke `<WORKER_URL>` untuk hal yang sama + pencarian semua kategori.

### Untuk admin
- `/admin` di bot atau login web: tambah/perpanjang/nonaktifkan buyer, set login web buyer, backup manual, restore, atur jadwal backup.
- Admin juga otomatis punya “profil buyer” sendiri sehingga bisa menguji IMAP/domain.

---

## 🎨 Branding (Ganti Nama & Teks)
Supaya tidak mirip brand lain, nama bot dan teks sambutan bisa kamu ganti sendiri — tersimpan di database dan langsung berlaku di **bot maupun dashboard** (judul halaman, header, pesan).

**Lewat bot (admin):**
- `/setbrand ⚡ MailVault` → ganti nama/brand.
- `/setwelcome Halo, kirim emailmu ya...` → ganti teks sambutan `/start` (boleh multi-baris).
- `/setwelcome reset` → kembalikan teks sambutan ke default.
- Atau buka panel `/admin` → tombol **🎨 Branding**.

**Lewat dashboard:** login admin → tab **Branding** → isi nama & teks sambutan → Simpan (muat ulang halaman untuk melihat judul baru).

> Karakter `<` dan `>` otomatis dibuang dari nama untuk mencegah error format.

## 🤖 Perintah Bot
| Perintah | Akses | Fungsi |
|---|---|---|
| `/start` | semua | Tampilan awal (sama untuk semua: admin/buyer/user) |
| `/menu` | admin/buyer | Buka menu sesuai role (admin/buyer saja) |
| `/myid` | semua | Lihat Telegram ID |
| `/setadmin` | pertama | Jadi admin pertama (sekali saja) |
| `/admin` | admin | Panel admin |
| `/grant <id> <hari>` | admin | Buat / perpanjang buyer |
| `/extend <id> <hari>` | admin | Perpanjang langganan |
| `/revoke <id>` | admin | Nonaktifkan buyer |
| `/buyer <id>` | admin | Lihat detail buyer |
| `/buyerlogin <id> <email> <pw>` | admin | Set login web buyer |
| `/setweblogin <email> <pw>` | admin | Set login web admin |
| `/setbrand <nama>` | admin | Ganti nama/brand bot |
| `/setwelcome <teks>` | admin | Ganti teks sambutan (`reset` = default) |
| `/restore` | admin | Restore dari file backup (.json) |

---

## ⚙️ Konfigurasi (vars & secrets)

**Variabel** (`wrangler.toml` → `[vars]`):
| Var | Default | Arti |
|---|---|---|
| `SEARCH_LOOKBACK` | 30 | (cadangan) rentang hari pencarian |
| `RATE_LIMIT_PER_MIN` | 10 | maks pencarian / menit / user |
| `SESSION_TTL_HOURS` | 168 | masa berlaku sesi login web (7 hari) |
| `BACKUP_RETENTION` | 20 | jumlah backup yang disimpan |
| `TZ_OFFSET` | 7 | offset jam zona waktu (WIB = 7) |

**Secrets** (`wrangler secret put`):
| Secret | Wajib | Arti |
|---|---|---|
| `BOT_TOKEN` | ✅ | Token bot dari @BotFather |
| `WEBHOOK_SECRET` | ✅ | Bagian path webhook & verifikasi |
| `BACKUP_KEY` | — | Kunci enkripsi backup (AES-GCM). Kosong = backup plaintext |

---

## 🗄️ Skema Database
Dibuat oleh `schema.sql`:
| Tabel | Isi |
|---|---|
| `admins` | daftar Telegram ID admin |
| `admin_accounts` | login web admin (email + hash) |
| `buyers` | data buyer, langganan, status, login web |
| `imap_servers` | konfigurasi IMAP per buyer (password plaintext) |
| `domains` | mapping domain → buyer → imap (unik) |
| `bot_state` | state wizard percakapan bot |
| `search_log` | log pencarian (rate limit & audit ringan) |
| `web_sessions` | token sesi login web |
| `settings` | pengaturan (jam backup, toggle, dll) |
| `backups` | snapshot backup tersimpan |

---

## 💾 Backup & Restore
- **Otomatis terjadwal**: cron tiap jam memeriksa `settings.backup_hour`; saat cocok (zona WIB) membuat snapshot. Tahan dobel dalam jam yang sama.
- **Backup perubahan**: dibuat otomatis saat ada perubahan data penting (buyer/IMAP/domain) jika toggle aktif; opsi “hanya user aktif”.
- **Retensi**: hanya `BACKUP_RETENTION` backup terbaru disimpan.
- **Restore**:
  - Bot: `/restore` lalu kirim file `.json`.
  - Web: tab **Backup** → pilih backup → **restore**.
  - Sebelum restore, sistem membuat backup pengaman otomatis.
- **Enkripsi**: jika `BACKUP_KEY` diisi, isi backup dienkripsi AES-GCM.
- **Jaring pengaman tambahan**: D1 punya **Time Travel** (pemulihan titik-waktu 30 hari) bawaan Cloudflare.

---

## 🔐 Keamanan
- Password login web (admin & buyer) disimpan sebagai **hash PBKDF2-SHA256**.
- Sesi web pakai **cookie HttpOnly + Secure + SameSite=Lax**.
- Webhook dilindungi **secret** pada path.
- ⚠️ Password **IMAP disimpan plaintext** di D1 (sesuai permintaan, agar mudah dipakai ulang). Konsekuensinya: **batasi siapa yang punya akses admin/dashboard & database**. Untuk enkripsi at-rest, pertimbangkan menyimpannya terenkripsi di kemudian hari.
- Jangan pernah commit `BOT_TOKEN`/secret ke git. Jika token pernah bocor, **revoke** lewat @BotFather (`/revoke`) lalu set ulang.

---

## 🛠️ Troubleshooting

**Bot diam, tidak membalas apa pun**
- Cek `getWebhookInfo`. Bila `last_error_message` berisi `Wrong response from the webhook: 404`, berarti `WEBHOOK_SECRET` di Worker ≠ secret di URL webhook.
- Pastikan `npx wrangler secret put WEBHOOK_SECRET` sudah diisi dan **sama persis** dengan path di `setWebhook`.
- Set ulang webhook dengan `&drop_pending_updates=true` untuk membuang antrian lama.

**`setWebhook` mengembalikan 404 / Not Found**
- Jangan ikut menulis tanda `< >`. Ganti placeholder dengan nilai asli.
- Pastikan URL Worker benar dan sudah ter-deploy (`<WORKER_URL>/healthz` = `FLIXVAULT OK`).

**`wrangler is not recognized` (Windows)**
- Pakai `npx wrangler ...` (wrangler ada di devDependencies lokal), atau install global: `npm install -g wrangler`.

**Pencarian gagal / “Gagal terhubung ke server email”**
- Cek IMAP via menu **Tes Koneksi** (bot) atau periksa host/port/keamanan.
- SSL/TLS biasanya port **993**; STARTTLS port **143**.
- Pastikan username & password IMAP benar dan domain memang menerima email Netflix.

**“Domain belum terdaftar” saat mencari**
- Domain dari email belum didaftarkan buyer mana pun. Daftarkan domain di menu **Kelola Domain**.

**Login web gagal**
- Pastikan sudah `/setweblogin` (admin) atau admin sudah set `/buyerlogin` (buyer), dan langganan buyer belum kedaluwarsa.

---

## 🗺️ Roadmap Tahap 3
Belum termasuk dalam paket ini (akan ditambah saat sudah ramai):
- **Payment gateway otomatis** — saran untuk Indonesia: **Tripay** (paling mudah mulai), Midtrans, atau Xendit. (Telegram Payments & Stripe/PayPal kurang cocok untuk terima dana di Indonesia.)
- **Pengingat kedaluwarsa otomatis** + perpanjangan mandiri.

Untuk sekarang aktivasi & perpanjangan dilakukan manual via `/grant` / `/extend`.
