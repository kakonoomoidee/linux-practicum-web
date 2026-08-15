# 🐧 Platform Praktikum Linux — Container On-Demand (v4.2)

Platform penyediaan lingkungan Linux berbasis container untuk kebutuhan praktikum mahasiswa, dengan model self-service melalui browser. Browser hanya berfungsi sebagai **entry point** untuk provisioning; akses operasional tetap dilakukan mahasiswa melalui SSH dari terminal masing-masing. Setiap container memiliki masa hidup terbatas (TTL, default 24 jam) dan dihapus otomatis setelah kedaluwarsa.

📖 Dokumentasi terkait: **[about-proyek.md](./about-proyek.md)** (latar belakang proyek dan rasional keputusan teknis) dan **[WALKTHROUGH.md](./WALKTHROUGH.md)** (tinjauan fitur yang telah diimplementasikan).

> ⚠️ **Catatan desain:** platform ini dirancang untuk diakses eksklusif dari jaringan kampus/LAN dan tidak dimaksudkan untuk diekspos ke internet publik.

## Changelog

**v4.2**
- Halaman **Log Server** pada admin panel (`/admin/logs`) — administrator dapat meninjau log aplikasi langsung dari browser, dengan filter berdasarkan level, kata kunci, dan jumlah baris.
- Seluruh konfigurasi Docker Compose kini bersumber dari variabel environment, termasuk port PostgreSQL sisi host (`DB_HOST_PORT`) — menghindari konflik dengan instance PostgreSQL lain yang mungkin sudah berjalan di port default 5432.
- Perbaikan keamanan: pengaturan `trust proxy` tidak lagi menggunakan nilai `true` (yang berisiko terhadap spoofing IP), digantikan variabel `TRUST_PROXY_HOPS` yang eksplisit.

**v4.1**
- **Structured logging** menggunakan Winston — level log mengikuti konvensi industri (`error`/`warn`/`info`/`http`/`debug`), format JSON untuk file dan console produksi, format berwarna untuk console pengembangan.
- **Request logging** — setiap HTTP request memperoleh `requestId` unik untuk keperluan tracing, dicatat beserta method, path, status, durasi, IP, dan NIM (jika terautentikasi).
- **Rotasi file log otomatis** — `logs/error-YYYY-MM-DD.log` (khusus level error) dan `logs/combined-YYYY-MM-DD.log` (seluruh level), rotasi harian dengan retensi 14 hari, dipasang sebagai volume pada Docker Compose agar persisten dan dapat diakses langsung dari host.
- Seluruh pemanggilan `console.log`/`console.error` pada codebase telah dimigrasikan ke logger terstruktur.

**v4.0**
- **Auto-detect host SSH** — variabel `SSH_HOST_DISPLAY` tidak lagi wajib diisi manual. Sistem otomatis menggunakan `localhost` saat berjalan di WSL, atau memindai antarmuka jaringan pada server Linux. Override manual tetap didukung melalui `.env`.
- **Remember me** pada login — sesi dapat diperpanjang hingga 30 hari apabila dicentang (default: durasi sesi lebih pendek).
- **Toggle visibilitas password** pada seluruh field password.
- **Skeleton loading** pada dashboard selama proses pemuatan status, pembuatan container, dan penghapusan container.
- Dokumentasi proyek: `about-proyek.md` dan `WALKTHROUGH.md`.

**v3.0**
- Migrasi ke **layered architecture** (Controller → Service → Repository).
- Migrasi basis data dari SQLite ke **PostgreSQL**.
- Migrasi frontend ke **EJS** (server-rendered) dengan **Tailwind CSS**.
- **Admin panel** — pemantauan instance aktif dan statistik penggunaan per mahasiswa.
- **Self-healing container**: sistem mendeteksi dan membersihkan secara otomatis record container yang telah tidak sinkron dengan Docker Engine (misalnya akibat penghapusan manual atau crash), sehingga tidak lagi memerlukan intervensi manual pada basis data.
- Sesi disimpan pada PostgreSQL (bukan in-memory), menghilangkan risiko memory leak dan kehilangan sesi saat restart.
- Migrasi arsitektur frontend dari SPA client-side ke server-rendered per-route, menghilangkan kelas bug terkait state management pada form input.
- Orkestrasi deployment melalui **Docker Compose**.

---

## Arsitektur

Aplikasi mengikuti pola layered architecture dengan alur permintaan sebagai berikut:

```
Request
  │
  ▼
Routes           (src/routes/*)         — definisi endpoint dan middleware
  │
  ▼
Controllers      (src/controllers/*)    — penanganan request/response HTTP
  │
  ▼
Services         (src/services/*)       — logika bisnis (validasi, self-healing, rollback)
  │
  ▼
Repositories     (src/repositories/*)   — akses data murni, tanpa logika bisnis
  │
  ▼
PostgreSQL
```

Provisioning Docker (`dockerService.js`) diperlakukan sebagai service tersendiri yang dikonsumsi oleh `containerService.js`.

---

## Struktur Proyek

```
.
├── about-proyek.md                    # Latar belakang proyek dan rasional keputusan teknis
├── WALKTHROUGH.md                     # Tinjauan fitur yang telah diimplementasikan
├── docker-compose.yml                 # Orkestrasi service app + PostgreSQL
├── Dockerfile                         # Image untuk web app (multi-stage build)
├── .dockerignore
├── server.js                          # Entry point aplikasi
├── src/
│   ├── config/
│   │   ├── env.js                     # Konfigurasi terpusat dari environment variable
│   │   └── logger.js                  # Winston structured logger (JSON + rotasi file)
│   ├── db/
│   │   ├── connection.js              # PostgreSQL connection pool
│   │   ├── schema.sql                 # Skema basis data (idempotent)
│   │   └── initSchema.js              # Inisialisasi skema saat startup
│   ├── repositories/                  # Akses data (async/await, node-postgres)
│   │   ├── studentRepository.js
│   │   ├── containerRepository.js
│   │   ├── activityLogRepository.js
│   │   └── adminRepository.js
│   ├── services/                      # Logika bisnis
│   │   ├── authService.js
│   │   ├── containerService.js        # Self-healing dan rollback logic
│   │   ├── dockerService.js
│   │   ├── adminService.js
│   │   └── logService.js              # Pembacaan & parsing file log untuk admin panel
│   ├── controllers/                   # Penanganan HTTP request/response
│   │   ├── authController.js
│   │   ├── containerController.js
│   │   ├── viewController.js
│   │   └── adminController.js
│   ├── middleware/
│   │   ├── auth.js                    # Guard sesi mahasiswa
│   │   ├── adminAuth.js               # Guard sesi admin
│   │   └── requestLogger.js           # Logging HTTP request + requestId untuk tracing
│   ├── routes/
│   │   ├── authRoutes.js              # /api/auth/*
│   │   ├── containerRoutes.js         # /api/containers/*
│   │   ├── viewRoutes.js              # Halaman: /login, /dashboard, dll.
│   │   └── adminRoutes.js             # /admin/*
│   ├── cron/cleanupJob.js             # Penghapusan otomatis container kedaluwarsa
│   └── utils/
│       ├── ServiceError.js            # Error class kustom antar layer
│       └── detectHost.js              # Auto-detect IP/host untuk SSH mahasiswa
├── logs/                              # File log (rotasi harian, isi di-gitignore)
├── views/                             # Template EJS (Tailwind via CDN)
│   ├── partials/
│   │   ├── head.ejs
│   │   └── password-field.ejs         # Komponen input password dengan toggle visibilitas
│   ├── login.ejs
│   ├── change-password.ejs
│   ├── dashboard.ejs
│   └── admin/
│       ├── login.ejs
│       ├── dashboard.ejs              # Monitoring instance dan statistik penggunaan
│       └── logs.ejs                   # Log viewer
├── public/js/                         # Client-side script untuk komunikasi dengan /api/*
├── docker/                            # Dockerfile dan entrypoint image mahasiswa
├── scripts/
│   ├── seed.js                        # Seeding akun admin (kredensial aman)
│   ├── import-students.js             # Import daftar mahasiswa dari CSV
│   └── build-image.sh
└── .env.example
```

---

## Self-Healing: Penanganan Container yang Tidak Sinkron dengan Docker Engine

Pada implementasi awal, apabila sebuah container dihapus secara manual atau mengalami crash di level Docker sementara record pada basis data masih berstatus `'running'`, mahasiswa terkait akan terus ditolak saat mencoba membuat container baru (dibatasi 1 container aktif per mahasiswa). Satu-satunya jalan keluar pada saat itu adalah intervensi manual administrator ke basis data.

**Alur penanganan saat ini** (lihat `src/services/containerService.js`, fungsi `createForStudent`):

1. Mahasiswa mengajukan permintaan pembuatan container baru.
2. Sistem memeriksa keberadaan record berstatus `'running'` untuk NIM tersebut.
3. Apabila ditemukan, sistem melakukan **verifikasi langsung ke Docker Engine** (`dockerService.isContainerAlive`) untuk memastikan status sebenarnya:
   - Container masih berjalan → permintaan ditolak dengan pesan yang jelas.
   - Container sudah tidak ada di Docker Engine (respons 404) → record lama otomatis ditandai `destroyed`, dicatat pada log, dan mahasiswa dapat langsung melanjutkan pembuatan container baru tanpa keterlibatan administrator.
   - Docker Engine tidak dapat dihubungi (daemon tidak aktif) → sistem **tidak** menghapus record apa pun demi keamanan data, dan mengembalikan pesan error yang informatif.
4. Apabila lolos pemeriksaan, container baru dibuat pada Docker Engine.
5. Apabila container berhasil dibuat namun **gagal disimpan ke basis data** (misalnya akibat koneksi database terputus), sistem melakukan **rollback otomatis** dengan menghapus kembali container yang baru dibuat, mencegah munculnya container "orphan" yang berjalan tanpa tercatat.

Administrator juga dapat melakukan force-delete terhadap instance kapan pun melalui admin panel tanpa perlu mengakses basis data secara langsung.

---

## 🐳 Deployment dengan Docker Compose (Direkomendasikan)

Deployment dibungkus menjadi dua service: `app` (aplikasi Node.js) dan `db` (PostgreSQL). Instalasi manual Node.js maupun PostgreSQL pada server tidak diperlukan — cukup Docker Engine.

**Catatan arsitektur:** karena aplikasi memerlukan kendali atas Docker Engine untuk melakukan provisioning container mahasiswa, service `app` dijalankan dengan **Docker socket host dipasang ke dalamnya** (`/var/run/docker.sock`). Mekanisme ini memungkinkan `app` memerintahkan Docker Engine milik host untuk membuat/menghapus container mahasiswa sebagai *sibling container* — bukan Docker-in-Docker, melainkan delegasi perintah ke Docker Engine yang sama dengan yang digunakan host. Konsekuensinya, container mahasiswa yang dibuat memiliki port yang di-bind langsung ke host.

Service `app` juga menggunakan `network_mode: host`, yang memungkinkan **auto-detect IP LAN server** untuk ditampilkan kepada mahasiswa (lihat `about-proyek.md` untuk rasional lengkap). Pada Docker Desktop (Windows/Mac), mode ini kurang konsisten — apabila auto-detect tidak akurat, isi `SSH_HOST_DISPLAY` secara manual pada `.env`; nilai manual senantiasa diprioritaskan.

### 1. Prasyarat

- Docker Engine dan Docker Compose plugin (`docker compose version` untuk verifikasi)

### 2. Konfigurasi environment

```bash
cd linux-praktikum
cp .env.example .env
```

Parameter minimal yang perlu disesuaikan pada `.env`:
- `PGPASSWORD` — kata sandi PostgreSQL (jangan gunakan nilai default)
- `SESSION_SECRET` — string acak yang panjang
- `ADMIN_USERNAME` / `ADMIN_PASSWORD` — kosongkan `ADMIN_PASSWORD` untuk generate otomatis saat seeding
- `SSH_HOST_DISPLAY` — biarkan kosong (default) untuk auto-detect; isi manual hanya apabila hasil deteksi tidak sesuai
- `DB_HOST_PORT` — port PostgreSQL sisi host (default `5433`, sengaja bukan `5432` untuk menghindari konflik dengan instance PostgreSQL lain yang mungkin sudah berjalan)

### 3. Build dan menjalankan

```bash
docker compose up -d --build
```

Proses ini secara otomatis: build image `app`, menarik image `postgres:16-alpine`, menunggu PostgreSQL siap (healthcheck), kemudian menjalankan `app` (skema basis data diinisialisasi otomatis saat startup, dengan mekanisme retry apabila PostgreSQL belum sepenuhnya siap).

Verifikasi status:
```bash
docker compose ps
docker compose logs -f app
```

### 4. Seeding akun admin

```bash
npm run docker:seed
# atau: docker compose exec app node scripts/seed.js
```

Catat kredensial admin yang ditampilkan (apabila `ADMIN_PASSWORD` dikosongkan pada `.env`, password digenerate secara acak dan hanya ditampilkan satu kali).

### 5. Build image container mahasiswa

Image ini berbeda dari image `app` — digunakan untuk container per-mahasiswa (Ubuntu + SSH). Karena `app` hanya mendelegasikan perintah ke Docker Engine host, image ini dibangun **langsung di host**, bukan di dalam container `app`:

```bash
chmod +x scripts/build-image.sh
./scripts/build-image.sh
```

### 6. Import daftar mahasiswa

```bash
docker compose cp daftar-mahasiswa.csv app:/app/daftar-mahasiswa.csv
docker compose exec app node scripts/import-students.js daftar-mahasiswa.csv
```

### 7. Verifikasi akses

- Dashboard mahasiswa: `http://<ip-server>:3000/login`
- Dashboard admin: `http://<ip-server>:3000/admin/login`

### Referensi Perintah Operasional

| Kebutuhan | Perintah |
|---|---|
| Log aplikasi secara real-time | `npm run docker:logs` |
| Restart seluruh service | `docker compose restart` |
| Stop seluruh service (data tetap tersimpan) | `npm run docker:down` |
| Stop dan **hapus seluruh data basis data** (destruktif) | `docker compose down -v` |
| Masuk ke shell container `app` | `docker compose exec app sh` |
| Masuk ke psql basis data | `docker compose exec db psql -U praktikum_user -d praktikum_db` |
| Update setelah perubahan kode | `docker compose up -d --build` |

### Kebijakan Akses PostgreSQL

Port PostgreSQL sisi host (`DB_HOST_PORT`, default `5433`) hanya di-bind ke `127.0.0.1` (loopback), bukan ke seluruh antarmuka jaringan (`0.0.0.0`). Dengan konfigurasi ini, PostgreSQL tetap tidak dapat diakses dari jaringan kampus/LAN, namun tetap dapat dijangkau oleh proses lain pada mesin/VM yang sama — termasuk service `app` (karena menggunakan `network_mode: host`), maupun tool eksternal seperti DBeaver/pgAdmin untuk keperluan debugging langsung dari host.

---

## Deployment Manual (Tanpa Docker)

### 1. Prasyarat

- Node.js 18+
- PostgreSQL 14+ (terinstal dan berjalan)
- Docker Engine dengan akses `/var/run/docker.sock` untuk user yang menjalankan Node.js

```bash
sudo usermod -aG docker $USER   # logout/login ulang setelah perintah ini
```

### 2. Persiapan basis data

```bash
sudo -u postgres psql -c "CREATE USER praktikum_user WITH PASSWORD 'ganti_password_ini';"
sudo -u postgres psql -c "CREATE DATABASE praktikum_db OWNER praktikum_user;"
```

### 3. Instalasi dan konfigurasi

```bash
cd linux-praktikum
npm install
cp .env.example .env
```

Parameter minimal pada `.env`:
- `DATABASE_URL` (atau `PGHOST`/`PGUSER`/`PGPASSWORD`/`PGDATABASE` secara terpisah)
- `SESSION_SECRET` — string acak yang panjang
- `SSH_HOST_DISPLAY` — biarkan kosong untuk auto-detect
- `ADMIN_USERNAME` / `ADMIN_PASSWORD` — kosongkan `ADMIN_PASSWORD` untuk generate otomatis

### 4. Seeding akun admin

```bash
npm run seed
```

Perintah ini aman dijalankan berulang kali — akun admin yang sudah ada tidak akan ditimpa. Apabila password digenerate otomatis, segera catat karena hanya ditampilkan satu kali.

### 5. Build image container mahasiswa

```bash
chmod +x scripts/build-image.sh
./scripts/build-image.sh
```

### 6. Import daftar mahasiswa

```bash
node scripts/import-students.js path/ke/daftar-mahasiswa.csv
```

Aman dijalankan berulang kali — NIM yang sudah terdaftar akan dilewati tanpa menimpa password yang sudah diganti mahasiswa.

### 7. Menjalankan server

```bash
npm start
```

Firewall kampus perlu dikonfigurasi untuk mengizinkan akses ke port `3000` dan rentang `SSH_PORT_MIN`–`SSH_PORT_MAX` **hanya dari subnet kampus**, dan memblokir akses dari luar.

### Menjalankan sebagai Service (Opsional)

```bash
npm install -g pm2
pm2 start server.js --name praktikum-linux
pm2 save && pm2 startup
```

---

## Monitoring dan Logging

Seluruh aktivitas signifikan (autentikasi, pembuatan/penghapusan container, self-healing, rollback, error) dicatat secara terstruktur menggunakan **Winston**, dengan format JSON dan level log mengikuti konvensi industri: `error` > `warn` > `info` > `http` > `debug`.

### Log Viewer pada Admin Panel

Administrator dapat meninjau log aplikasi langsung dari browser melalui `/admin/logs`, tanpa memerlukan akses terminal ke server. Fitur yang tersedia:
- Filter berdasarkan level (`error`, `warn`, `info`, `http`, `debug`)
- Pencarian bebas berdasarkan kata kunci (NIM, pesan, nama event, request ID, dsb.)
- Pengaturan jumlah baris yang ditampilkan (100–1000)

### Akses Log via Command Line

```bash
# Melalui Docker Compose
npm run docker:logs
# atau:
docker compose logs -f app

# Melalui file (deployment manual)
npm run logs:tail          # seluruh level
npm run logs:errors        # khusus level error
```

### Struktur File Log

```
logs/
├── combined-2026-08-15.log   # seluruh level log
├── error-2026-08-15.log      # khusus level error
└── ...                        # rotasi harian, retensi 14 hari
```

Setiap baris merupakan objek JSON yang valid, contoh:
```json
{"level":"info","message":"Container berhasil dibuat","nim":"20220140020","containerName":"student-20220140020-...","event":"container_created","timestamp":"2026-08-15T07:23:00.000Z"}
```

Field `event` digunakan secara konsisten pada log signifikan (`container_created`, `container_self_heal`, `container_rollback`, `admin_login_success`, `student_login_failed`, dsb.), memudahkan proses filtering dan agregasi. Format JSON yang konsisten juga memungkinkan integrasi langsung dengan tooling monitoring seperti ELK Stack, Grafana Loki, atau Datadog apabila diperlukan pada skala yang lebih besar.

### Tracing Request Individual

Setiap HTTP request memperoleh `requestId` unik (dikembalikan melalui response header `X-Request-Id`). Untuk menelusuri laporan error dari mahasiswa/admin, mintakan request ID terkait (dapat dilihat pada DevTools browser → tab Network → response header), kemudian:
```bash
grep "<request-id>" logs/combined-*.log
```

### Konfigurasi Level Log

Default: `debug` apabila `NODE_ENV` bukan `production`, `info` apabila `production`. Override manual melalui `.env`:
```
LOG_LEVEL=warn
```

---

## Admin Panel

Akses melalui `/admin/login` menggunakan kredensial hasil `npm run seed`. Fitur yang tersedia pada `/admin`:

- **Ringkasan statistik**: total mahasiswa terdaftar, jumlah instance aktif, total container yang pernah dibuat, jumlah login dalam 24 jam terakhir.
- **Tabel instance aktif**: NIM, nama mahasiswa, nama container, perintah SSH, waktu pembuatan/kedaluwarsa, serta opsi force-delete.
- **Tabel statistik penggunaan per mahasiswa**: total login, total container yang pernah dibuat, status aktif, dan waktu pembuatan container terakhir.
- **Log viewer** (`/admin/logs`): lihat bagian Monitoring dan Logging di atas.

---

## Alur Penggunaan Mahasiswa

1. Akses `http://<ip-server>:3000` dari jaringan kampus.
2. Login menggunakan NIM dan password default `12345678`.
3. Wajib mengganti password (tidak boleh identik dengan default).
4. Klik "Buat Container Baru" untuk memperoleh kredensial akses: IP, port, username, dan password.
5. Akses melalui terminal pribadi: `ssh mahasiswa@<ip> -p <port>`.
6. Container dihapus otomatis setelah TTL habis (default 24 jam, dapat diatur melalui `.env`).

---

## Kebijakan Keamanan

- Password web dan Linux di-hash menggunakan `bcrypt`.
- Password container ditampilkan satu kali saat pembuatan, tidak pernah disimpan dalam bentuk plaintext.
- Sesi disimpan pada PostgreSQL dengan cookie `httpOnly`.
- Rate limiting pada endpoint login (mahasiswa dan admin), 10 percobaan per 15 menit.
- Container mahasiswa: `CapDrop: ALL` dengan capability minimal (bukan mode `--privileged`), `PidsLimit: 256` (mitigasi fork-bomb), resource limit (memory/CPU/disk), `no-new-privileges`.
- Isolasi jaringan antar-container (`enable_icc=false`).
- Akun admin tidak pernah menggunakan password default yang lemah — digenerate secara acak apabila tidak diisi eksplisit pada `.env`.
- Pengaturan `trust proxy` menggunakan nilai eksplisit (`TRUST_PROXY_HOPS`), bukan `true`, untuk mencegah risiko spoofing header IP.

## Cakupan di Luar Kode (Perlu Konfigurasi Manual)

- **Firewall kampus** — pembatasan akses port dashboard dan rentang port SSH hanya dari subnet kampus.
- **Rate-limiting outbound traffic per container** (`tc`/`iptables`) sebagai mitigasi tambahan terhadap penyalahgunaan jaringan.
- **Monitoring resource** (`docker stats`, cAdvisor, Prometheus) untuk deteksi anomali penggunaan (mis. cryptomining).
- **HTTPS** melalui reverse proxy (nginx) apabila dashboard diakses melalui domain internal.
- **Backup PostgreSQL** berkala (`pg_dump`).

---

## Troubleshooting

### SSH dari terminal Windows/PowerShell gagal terhubung ke WSL

Penyebab paling umum bukan masalah jaringan, melainkan host yang ditampilkan pada dashboard tidak akurat. Sejak v4.0, biarkan `SSH_HOST_DISPLAY` kosong pada `.env` — sistem akan otomatis:
- Mendeteksi lingkungan WSL dan menggunakan `localhost` (memanfaatkan fitur bawaan WSL2 yang meneruskan port secara otomatis ke Windows)
- Mendeteksi server Linux reguler dan memindai antarmuka jaringan untuk memperoleh IP LAN yang sesuai

Periksa log server saat startup:
```
SSH host mahasiswa  : localhost  [auto-detect (WSL2 localhost forwarding)]
```

Apabila hasil deteksi tidak sesuai, lakukan override manual melalui `SSH_HOST_DISPLAY` pada `.env` — nilai manual senantiasa diprioritaskan.

Apabila host sudah sesuai namun koneksi tetap gagal, periksa:
- Container mahasiswa benar-benar berjalan (`docker ps`, cari nama `student-<nim>-...`)
- Docker Engine pada WSL aktif (bukan sekadar terinstal)
- Windows Firewall tidak memblokir port yang digunakan

### Konflik port PostgreSQL saat `docker compose up`

Sejak v4.2, port PostgreSQL sisi host dapat dikonfigurasi melalui `DB_HOST_PORT` (default `5433`, bukan `5432`) untuk menghindari konflik dengan instance PostgreSQL lain yang mungkin sudah berjalan pada mesin yang sama. Apabila port `5433` juga sudah terpakai, sesuaikan nilai `DB_HOST_PORT` pada `.env` ke port lain yang tersedia.

### Error native module saat `npm install` (bcrypt, ssh2, dsb.)

Kemungkinan besar disebabkan proyek berada pada drive Windows (`/mnt/c/...`, `/mnt/e/...`, dsb.) yang di-mount ke WSL. Native module memerlukan proses kompilasi C++ dan operasi filesystem bergaya Unix yang tidak sepenuhnya reliable pada DrvFs (jembatan WSL↔NTFS). Solusi: pindahkan proyek ke filesystem native WSL (`~/projects/...`), kemudian install ulang dependency.

---

## Referensi Kustomisasi

| Kebutuhan | Lokasi |
|---|---|
| TTL container | `.env` → `CONTAINER_TTL_HOURS` |
| Limit container per mahasiswa | `.env` → `MAX_CONTAINER_PER_STUDENT` |
| Package pada container mahasiswa | `docker/Dockerfile.student` |
| Resource limit | `.env` → `CONTAINER_MEMORY_MB`, `CONTAINER_CPU_LIMIT`, `CONTAINER_DISK_QUOTA_MB` |
| Tema visual | `views/partials/head.ejs` (konfigurasi Tailwind) |
| Konten admin panel | `views/admin/dashboard.ejs`, `src/services/adminService.js` |
| Port PostgreSQL sisi host | `.env` → `DB_HOST_PORT` |
| Level dan lokasi log | `.env` → `LOG_LEVEL`, `LOG_DIR` |
