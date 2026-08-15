# 🐧 Platform Praktikum Linux — Container On-Demand (v4)

Platform buat mahasiswa "minjem" container Linux full lewat browser (self-service), browser cuma jadi **entry point** — mahasiswa tetap SSH pakai terminal mereka sendiri. Container otomatis dihapus setelah TTL tertentu (default 24 jam).

📖 Dokumentasi lengkap: **[about-proyek.md](./about-proyek.md)** (latar belakang & alasan keputusan teknis) dan **[WALKTHROUGH.md](./WALKTHROUGH.md)** (tur fitur-per-fitur yang sudah dibangun).

📖 Dokumentasi lengkap: **[about-proyek.md](./about-proyek.md)** (latar belakang & alasan keputusan teknis) dan **[WALKTHROUGH.md](./WALKTHROUGH.md)** (tur fitur-per-fitur yang sudah dibangun).

**v4.1 changelog:**
- ✅ **Structured logging** (Winston) — log level standar industri (`error`/`warn`/`info`/`http`/`debug`), format JSON buat file & production console, format berwarna enak dibaca buat development
- ✅ **Request logging** — tiap HTTP request dapat `requestId` unik buat tracing, di-log dengan method/path/status/durasi/IP/NIM
- ✅ **File log dengan rotasi otomatis** — `logs/error-YYYY-MM-DD.log` (cuma error) dan `logs/combined-YYYY-MM-DD.log` (semua level), rotasi harian, disimpan 14 hari, di-mount sebagai volume di Docker Compose biar persist & gampang di-`tail`
- ✅ Semua `console.log`/`console.error` di seluruh codebase diganti logger terstruktur

**v4 changelog:**
- ✅ **Remember me** saat login — session bertahan 30 hari kalau dicentang (default: session lebih pendek)
- ✅ **Toggle show/hide password** (ikon mata) di semua field password
- ✅ **Skeleton loading** di dashboard saat memuat status, membuat container baru, dan menghapus container — biar ga terasa "diam" pas nunggu proses Docker
- ✅ Dokumentasi baru: `about-proyek.md` (source of truth) dan `WALKTHROUGH.md` (tur fitur)

**v3 changelog:**
- ✅ Layered architecture (Controller → Service → Repository)
- ✅ Database pindah dari SQLite ke **PostgreSQL**
- ✅ Frontend pindah ke **EJS** (server-rendered) + **Tailwind CSS**, tema white professional
- ✅ **Admin panel** — monitoring instance yang jalan + statistik pemakaian per mahasiswa
- ✅ **Self-healing**: kalau ada container "nyangkut" di DB (misal container-nya udah dihapus manual/crash di Docker tapi record-nya masih 'running'), sistem otomatis mendeteksi & membersihkan record itu sendiri saat mahasiswa coba bikin container baru — **tidak perlu lagi hapus tabel manual**
- ✅ Session disimpan di PostgreSQL (bukan in-memory), aman dari memory leak & survive restart
- ✅ Fix bug input login yang ga bisa diketik (pindah dari SPA client-side ke server-rendered page per route)
- ✅ Semua dibungkus **Docker Compose** (app + database), tinggal `docker compose up`

> ⚠️ Didesain untuk diakses **hanya dari jaringan kampus/LAN**, tidak expose ke public internet.

---

## Arsitektur (Layered)

```
Request
  │
  ▼
Routes           (src/routes/*)         — definisi endpoint, middleware apa yang jalan
  │
  ▼
Controllers      (src/controllers/*)    — terima request, panggil service, format response HTTP
  │
  ▼
Services         (src/services/*)       — LOGIKA BISNIS (validasi, self-healing, rollback, dst)
  │
  ▼
Repositories     (src/repositories/*)   — query database murni, tidak ada logika bisnis
  │
  ▼
PostgreSQL
```

Docker provisioning (`dockerService.js`) diperlakukan sebagai service tersendiri yang dipanggil oleh `containerService.js`.

---

## Struktur Project

```
.
├── about-proyek.md                    # ⭐ Source of truth: latar belakang & alasan keputusan teknis
├── WALKTHROUGH.md                     # ⭐ Tur fitur-per-fitur yang sudah dibangun
├── docker-compose.yml                 # Orkestrasi app + PostgreSQL jadi satu perintah
├── Dockerfile                         # Image buat web app (multi-stage build)
├── .dockerignore
├── server.js                          # Entry point
├── src/
│   ├── config/
│   │   ├── env.js                     # Semua config dari .env di satu tempat
│   │   └── logger.js                  # ⭐ Winston structured logger (JSON + rotasi file)
│   ├── db/
│   │   ├── connection.js              # PostgreSQL connection pool
│   │   ├── schema.sql                 # Schema (idempotent)
│   │   └── initSchema.js              # Runner buat schema.sql saat startup
│   ├── repositories/                  # Query DB murni (async/await, pg)
│   │   ├── studentRepository.js
│   │   ├── containerRepository.js
│   │   ├── activityLogRepository.js
│   │   └── adminRepository.js
│   ├── services/                      # Logika bisnis
│   │   ├── authService.js
│   │   ├── containerService.js        # ⭐ self-healing & rollback logic ada di sini
│   │   ├── dockerService.js
│   │   └── adminService.js
│   ├── controllers/                   # HTTP request/response handling
│   │   ├── authController.js
│   │   ├── containerController.js
│   │   ├── viewController.js
│   │   └── adminController.js
│   ├── middleware/
│   │   ├── auth.js                    # Guard mahasiswa
│   │   ├── adminAuth.js               # Guard admin
│   │   └── requestLogger.js           # ⭐ Log tiap HTTP request + requestId buat tracing
│   ├── routes/
│   │   ├── authRoutes.js              # /api/auth/*
│   │   ├── containerRoutes.js         # /api/containers/*
│   │   ├── viewRoutes.js              # /login, /dashboard, dst (halaman)
│   │   └── adminRoutes.js             # /admin/*
│   ├── cron/cleanupJob.js             # Auto-hapus container expired
│   └── utils/ServiceError.js          # Error class custom antar layer
├── logs/                              # File log (rotasi harian, di-gitignore isinya)
├── views/                             # EJS templates (Tailwind via CDN)
│   ├── partials/
│   │   ├── head.ejs
│   │   └── password-field.ejs         # Reusable input password + toggle show/hide
│   ├── login.ejs
│   ├── change-password.ejs
│   ├── dashboard.ejs
│   └── admin/
│       ├── login.ejs
│       └── dashboard.ejs              # Monitoring instance + usage stats
├── public/js/                         # JS minimal buat AJAX call ke /api/* (termasuk password-toggle.js)
├── docker/                            # Dockerfile + entrypoint image mahasiswa
├── scripts/
│   ├── seed.js                        # ⭐ Seed admin AMAN (password random kalau ga diisi)
│   ├── import-students.js             # Import NIM dari CSV elearning
│   └── build-image.sh
└── .env.example
```

---

## Self-Healing: Fix untuk Masalah "Harus Hapus Tabel Manual"

Sebelumnya, kalau container di Docker dihapus manual/crash tapi record di DB masih bilang `'running'`, mahasiswa keblokir bikin container baru selamanya (limit 1 container/mahasiswa) sampai admin hapus row itu manual di database.

**Sekarang alurnya** (lihat `src/services/containerService.js` fungsi `createForStudent`):

1. Mahasiswa klik "Buat Container Baru".
2. Sistem cek: ada record `'running'` di DB buat NIM ini?
3. Kalau ada → sistem **verifikasi langsung ke Docker Engine** apakah container itu BENERAN masih hidup (`dockerService.isContainerAlive`).
   - Masih hidup → ditolak dengan pesan jelas "sudah punya container aktif".
   - **Sudah tidak ada (404 dari Docker)** → record lama otomatis ditandai `destroyed`, log dicatat, mahasiswa **langsung bisa lanjut bikin container baru** tanpa campur tangan admin.
   - Docker Engine sendiri tidak bisa dihubungi (daemon down) → sistem **tidak** asal menghapus record (biar aman), kasih pesan error jelas "coba lagi nanti".
4. Kalau lolos, container baru dibuat di Docker.
5. Kalau container berhasil dibuat di Docker tapi **gagal disimpan ke database** (misal koneksi DB putus di tengah), sistem otomatis **rollback** — container yang baru dibuat di Docker langsung dihapus lagi, supaya tidak ada container "orphan" yang jalan tanpa tercatat.

Admin juga bisa force-delete instance kapan saja lewat admin panel kalau butuh intervensi manual (tanpa harus masuk ke database).

Sudah diuji end-to-end di lingkungan testing (lihat catatan pengujian): skenario record 'nyangkut' + Docker unreachable menghasilkan error 503 yang jelas tanpa menghapus data, memastikan sistem tidak pernah asal menghapus record ketika statusnya tidak bisa dipastikan.

---

## 🐳 Setup Paling Gampang: Docker Compose (Direkomendasikan)

Semua dibungkus jadi 2 service: `app` (web app Node.js) dan `db` (PostgreSQL). Tinggal `docker compose up`, ga perlu install Node/PostgreSQL manual di server kampus — cukup Docker Engine aja.

**Cara kerja penting:** karena app ini juga perlu "mengontrol" Docker buat bikin container mahasiswa, container `app` dijalankan dengan **Docker socket host di-mount ke dalamnya** (`/var/run/docker.sock`). Ini bikin app bisa nyuruh Docker Engine host bikin/hapus container mahasiswa sebagai *sibling container* — bukan Docker-di-dalam-Docker beneran, cuma "titip perintah" ke Docker Engine yang sama dengan yang dipakai host. Konsekuensinya: container mahasiswa yang dibuat itu port-nya ke-bind ke **host**, jadi `SSH_HOST_DISPLAY` di `.env` tetap harus IP LAN kampus (bukan nama service `app`/`db`).

### 1. Prasyarat

- Docker Engine + Docker Compose plugin terinstall di server kampus (`docker compose version` buat cek)

### 2. Setup environment

```bash
cd linux-praktikum
cp .env.example .env
```

Edit `.env`, minimal ubah:
- `PGPASSWORD` — password PostgreSQL (jangan biarin default)
- `SESSION_SECRET` — random string panjang
- `SSH_HOST_DISPLAY` — IP LAN server kampus (yang dipakai mahasiswa buat SSH nantinya)
- `ADMIN_USERNAME` / `ADMIN_PASSWORD` — kosongin `ADMIN_PASSWORD` kalau mau di-generate otomatis pas seed

### 3. Build & jalankan

```bash
docker compose up -d --build
```

Ini otomatis: build image app, tarik image `postgres:16-alpine`, tunggu PostgreSQL siap (`healthcheck`), baru start app (skema DB otomatis dibuat saat app start, dengan retry kalau DB-nya belum bener-bener siap).

Cek statusnya:
```bash
docker compose ps
docker compose logs -f app
```

### 4. Bikin akun admin (seed)

```bash
npm run docker:seed
# atau manual: docker compose exec app node scripts/seed.js
```

Catat password admin yang ditampilkan (kalau `ADMIN_PASSWORD` dikosongkan di `.env`, password di-generate random dan cuma ditampilkan sekali di sini).

### 5. Build image Docker buat container mahasiswa

Ini **beda** dari image `app` — ini image yang dipakai buat container per-mahasiswa (Ubuntu + SSH). Karena `app` cuma numpang perintah ke Docker Engine host, image ini di-build **langsung di host**, bukan di dalam container `app`:

```bash
chmod +x scripts/build-image.sh
./scripts/build-image.sh
```

### 6. Import daftar mahasiswa

```bash
# Copy dulu file CSV ke dalam container, atau jalanin dari host kalau Node lokal ada.
# Cara paling gampang: exec masuk container app, lalu jalanin import di sana:
docker compose cp daftar-mahasiswa.csv app:/app/daftar-mahasiswa.csv
docker compose exec app node scripts/import-students.js daftar-mahasiswa.csv
```

### 7. Selesai

- Dashboard mahasiswa: `http://<ip-server>:3000/login`
- Dashboard admin: `http://<ip-server>:3000/admin/login`

### Perintah harian yang berguna

| Kebutuhan | Command |
|---|---|
| Lihat log app real-time | `npm run docker:logs` |
| Restart semua service | `docker compose restart` |
| Stop semua (data tetap aman di volume) | `npm run docker:down` / `docker compose down` |
| Stop + **hapus semua data DB** (hati-hati!) | `docker compose down -v` |
| Masuk shell container app buat debug | `docker compose exec app sh` |
| Masuk psql ke database | `docker compose exec db psql -U praktikum_user -d praktikum_db` |
| Update setelah ganti kode | `docker compose up -d --build` |

### Kenapa port PostgreSQL ga di-publish ke host?

Di `docker-compose.yml`, service `db` sengaja **tidak** membuka port `5432` ke host — database cuma bisa diakses dari dalam Docker network internal (oleh service `app`). Ini lebih aman daripada expose ke jaringan kampus. Kalau kamu perlu connect langsung pakai DBeaver/pgAdmin dari host buat debug, buka comment baris `ports: - "5432:5432"` di bagian `db` pada `docker-compose.yml`, lalu `docker compose up -d` ulang.

---

## Setup Manual (Tanpa Docker)

### 1. Prasyarat

- Node.js 18+
- **PostgreSQL 14+** terinstall & jalan
- Docker Engine terinstall & daemon jalan, user Node punya akses ke `/var/run/docker.sock`

```bash
sudo usermod -aG docker $USER   # logout/login ulang setelah ini
```

### 2. Setup database

```bash
sudo -u postgres psql -c "CREATE USER praktikum_user WITH PASSWORD 'ganti_password_ini';"
sudo -u postgres psql -c "CREATE DATABASE praktikum_db OWNER praktikum_user;"
```

### 3. Install & konfigurasi

```bash
cd linux-praktikum
npm install
cp .env.example .env
```

Edit `.env`, minimal:
- `DATABASE_URL` (atau `PGHOST`/`PGUSER`/`PGPASSWORD`/`PGDATABASE` terpisah)
- `SESSION_SECRET` — random string panjang
- `SSH_HOST_DISPLAY` — IP internal server kampus
- `ADMIN_USERNAME` / `ADMIN_PASSWORD` — kalau `ADMIN_PASSWORD` dikosongkan, script seed akan generate password random yang aman

### 4. Jalankan seed (bikin akun admin)

```bash
npm run seed
```

Ini **aman dijalankan berkali-kali** — kalau akun admin sudah ada, tidak akan ditimpa/direset. Kalau password di-generate otomatis, **catat sekarang juga**, karena hanya ditampilkan sekali di terminal (yang tersimpan di DB cuma hash-nya).

### 5. Build image Docker mahasiswa

```bash
chmod +x scripts/build-image.sh
./scripts/build-image.sh
```

### 6. Import daftar mahasiswa

Export CSV dari elearning (kolom `nim,nama`), lalu:

```bash
node scripts/import-students.js path/ke/daftar-mahasiswa.csv
```

Aman dijalankan berkali-kali, NIM yang sudah ada di-skip (tidak menimpa password yang sudah diganti mahasiswa).

### 7. Jalankan server

```bash
npm start
```

- Dashboard mahasiswa: `http://<ip-server>:3000/login`
- Dashboard admin: `http://<ip-server>:3000/admin/login`

Firewall kampus: **allow** port `3000` dan range `SSH_PORT_MIN`-`SSH_PORT_MAX` **hanya dari subnet kampus**, **block** dari luar.

### (Opsional) pm2 buat auto-restart

```bash
npm install -g pm2
pm2 start server.js --name praktikum-linux
pm2 save && pm2 startup
```

---

## Monitoring & Logs

Semua aktivitas penting (login, bikin/hapus container, self-healing, rollback, error) di-log terstruktur pakai **Winston**, format JSON, dengan level standar industri: `error` > `warn` > `info` > `http` > `debug`.

### Lihat log real-time

```bash
# Lewat Docker Compose (paling gampang)
npm run docker:logs
# atau langsung:
docker compose logs -f app

# Lewat file (kalau jalan manual tanpa Docker)
npm run logs:tail          # semua level
npm run logs:errors        # cuma error
```

### Struktur file log

```
logs/
├── combined-2026-08-15.log   # SEMUA level log
├── error-2026-08-15.log      # CUMA level error (gampang cari masalah)
└── ...                        # rotasi harian, auto-hapus setelah 14 hari
```

Tiap baris adalah satu objek JSON valid, contoh:
```json
{"level":"info","message":"Container berhasil dibuat","nim":"20220140020","containerName":"student-20220140020-...","event":"container_created","timestamp":"2026-08-15T07:23:00.000Z"}
```

Field `event` konsisten di banyak log penting (`container_created`, `container_self_heal`, `container_rollback`, `admin_login_success`, `student_login_failed`, dst) — berguna kalau nanti mau di-filter/agregasi (`grep '"event":"container_self_heal"' logs/combined-*.log`), atau di-pipe ke tool monitoring beneran (ELK, Grafana Loki, Datadog, dll) karena formatnya udah JSON siap-pakai.

### Tracing satu request tertentu

Setiap request dapat `requestId` unik (juga dikembalikan lewat response header `X-Request-Id`). Kalau ada laporan error dari mahasiswa/admin, minta mereka screenshot/kirim request ID-nya (bisa dilihat di DevTools browser → Network tab → response header), lalu:
```bash
grep "<request-id>" logs/combined-*.log
```
Ini nunjukin seluruh jejak request itu, termasuk error detail kalau ada.

### Atur level log

Default: `debug` kalau `NODE_ENV` bukan `production`, `info` kalau production. Override manual lewat `.env`:
```
LOG_LEVEL=warn   # cuma tampilkan warning ke atas, misalnya buat produksi yang santai
```

## Admin Panel

Buka `/admin/login`, login dengan akun dari hasil `npm run seed`. Halaman admin (`/admin`) menampilkan:

- **Summary cards**: total mahasiswa, instance aktif, total container sepanjang waktu, login 24 jam terakhir.
- **Tabel instance yang sedang jalan**: NIM, nama, nama container, perintah SSH, waktu dibuat/kadaluarsa, tombol **Hapus** (force-destroy tanpa perlu masuk ke database).
- **Tabel statistik pemakaian per mahasiswa**: total login, total container pernah dibuat, status aktif/tidak, terakhir bikin container — buat lihat siapa yang aktif pakai platform dan siapa yang belum.

---

## Alur pemakaian mahasiswa

1. Buka `http://<ip-server>:3000` dari jaringan kampus.
2. Login pakai NIM + password default `12345678`.
3. Wajib ganti password (tidak boleh sama dengan default).
4. Klik "Buat Container Baru" → dapat info IP, port, username, password.
5. Buka terminal sendiri: `ssh mahasiswa@<ip> -p <port>`.
6. Container otomatis terhapus setelah TTL habis (default 24 jam, atur di `.env`).

---

## Keamanan yang diterapkan

- Password web & Linux di-hash `bcrypt`.
- Password container ditampilkan sekali, tidak disimpan plaintext.
- Session disimpan di PostgreSQL, cookie `httpOnly`.
- Rate limiting login (mahasiswa & admin), 10x/15 menit.
- Container: `CapDrop: ALL` + capability minimal (bukan `--privileged`), `PidsLimit: 256` (anti fork-bomb), resource limit (memory/CPU/disk), `no-new-privileges`.
- Network container terisolasi (`enable_icc=false`) — antar container tidak bisa saling akses.
- Seed admin **tidak pernah pakai password default lemah** — generate random kalau tidak diisi eksplisit di `.env`.

## Yang masih perlu kamu setup sendiri (di luar kode)

- **Firewall kampus** — port dashboard & range SSH cuma reachable dari subnet kampus.
- **Rate-limit outbound traffic per container** (`tc`/`iptables`) kalau mau jaga-jaga dari penyalahgunaan jaringan.
- **Monitoring resource** (`docker stats` / cAdvisor / Prometheus) buat deteksi anomali (mining, dsb).
- **HTTPS** via reverse proxy (nginx) kalau dashboard diakses lewat domain internal.
- **Backup PostgreSQL** berkala (`pg_dump`).

---

## Kustomisasi cepat

| Mau ubah apa | Di file mana |
|---|---|
| TTL container | `.env` → `CONTAINER_TTL_HOURS` |
| Limit container per mahasiswa | `.env` → `MAX_CONTAINER_PER_STUDENT` |
| Package di container mahasiswa | `docker/Dockerfile.student` |
| Resource limit | `.env` → `CONTAINER_MEMORY_MB`, `CONTAINER_CPU_LIMIT`, `CONTAINER_DISK_QUOTA_MB` |
| Warna/tema tampilan | `views/partials/head.ejs` (Tailwind config) |
| Isi halaman admin | `views/admin/dashboard.ejs`, `src/services/adminService.js` |
