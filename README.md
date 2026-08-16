# 🐧 Platform Praktikum Linux — Container On-Demand (v4.2)

Platform penyediaan lingkungan Linux berbasis container untuk kebutuhan praktikum mahasiswa, dengan model self-service melalui browser. Browser hanya berfungsi sebagai **entry point** untuk provisioning; akses operasional tetap dilakukan mahasiswa melalui SSH dari terminal masing-masing. Setiap container memiliki masa hidup terbatas (TTL, default 24 jam) dan dihapus otomatis setelah kedaluwarsa.

📖 Dokumentasi terkait: **[about-proyek.md](./about-proyek.md)** (latar belakang proyek dan rasional keputusan teknis) dan **[WALKTHROUGH.md](./WALKTHROUGH.md)** (tinjauan fitur yang telah diimplementasikan).

> ⚠️ **Catatan desain:** platform ini dirancang untuk diakses eksklusif dari jaringan kampus/LAN dan tidak dimaksudkan untuk diekspos ke internet publik.

## Quick Start

```bash
git clone https://github.com/kakonoomoidee/linux-practicum-web.git
cd linux-practicum-web
cp .env.example .env          # sesuaikan PGPASSWORD & SESSION_SECRET minimal
docker compose up -d --build
docker compose exec app node scripts/seed.js              # catat kredensial admin yang ditampilkan
./scripts/build-image.sh                                  # build image container mahasiswa
docker compose exec app node scripts/import-students.js <file.csv>
```

Dashboard mahasiswa: `http://<ip-server>:3000/login` — Dashboard admin: `http://<ip-server>:3000/admin/login`

Instalasi Node.js dan PostgreSQL secara manual pada server **tidak diperlukan** — satu-satunya prasyarat adalah Docker Engine. Penjelasan tiap langkah tersedia pada bagian "Instalasi dan Deployment" di bawah.

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

## 🐳 Instalasi dan Deployment

Platform ini sepenuhnya dibungkus dengan **Docker Compose** — dua service (`app` untuk aplikasi Node.js, `db` untuk PostgreSQL) dijalankan dan dikelola melalui satu perintah. Instalasi Node.js maupun PostgreSQL secara manual pada server **tidak diperlukan**; satu-satunya prasyarat adalah Docker Engine.

### Prasyarat

- **Docker Engine** dan **Docker Compose plugin** terinstal. Verifikasi dengan:
  ```bash
  docker --version
  docker compose version
  ```
  Apabila belum terinstal, ikuti panduan resmi sesuai sistem operasi pada [docs.docker.com/engine/install](https://docs.docker.com/engine/install/).
- Untuk pengguna WSL2: pastikan menjalankan Docker Engine native pada distribusi WSL (bukan Docker Desktop), agar fitur `network_mode: host` dan auto-detect IP berfungsi optimal (lihat bagian "Catatan Arsitektur" di bawah).

### Catatan Arsitektur

Karena aplikasi memerlukan kendali atas Docker Engine untuk melakukan provisioning container mahasiswa, service `app` dijalankan dengan **Docker socket host dipasang ke dalamnya** (`/var/run/docker.sock`). Mekanisme ini memungkinkan `app` memerintahkan Docker Engine milik host untuk membuat/menghapus container mahasiswa sebagai *sibling container* — bukan Docker-in-Docker, melainkan delegasi perintah ke Docker Engine yang sama dengan yang digunakan host. Konsekuensinya, container mahasiswa yang dibuat memiliki port yang di-bind langsung ke host.

Service `app` juga menggunakan `network_mode: host`, yang memungkinkan **auto-detect IP LAN server** untuk ditampilkan kepada mahasiswa tanpa konfigurasi manual (lihat `about-proyek.md` untuk rasional lengkap). Pada Docker Desktop (Windows/Mac), mode ini kurang konsisten akibat perbedaan virtualisasi jaringan — apabila auto-detect tidak akurat, isi `SSH_HOST_DISPLAY` secara manual pada `.env`; nilai manual senantiasa diprioritaskan.

### 1. Clone repository

```bash
git clone https://github.com/kakonoomoidee/linux-practicum-web.git
cd linux-practicum-web
```

### 2. Konfigurasi environment

```bash
cp .env.example .env
```

Seluruh parameter memiliki nilai default yang berfungsi untuk kebutuhan pengujian, namun untuk deployment produksi minimal sesuaikan:

| Variabel | Keterangan |
|---|---|
| `PGPASSWORD` | Kata sandi PostgreSQL — **wajib diganti** dari nilai default |
| `SESSION_SECRET` | String acak yang panjang, digunakan untuk enkripsi cookie sesi |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | Kosongkan `ADMIN_PASSWORD` agar digenerate otomatis secara acak saat seeding (lebih aman dibanding password statis) |
| `SSH_HOST_DISPLAY` | Biarkan kosong (default) untuk auto-detect; isi manual hanya apabila hasil deteksi tidak sesuai |
| `DB_HOST_PORT` | Port PostgreSQL sisi host (default `5433`, sengaja bukan `5432` untuk menghindari konflik dengan instance PostgreSQL lain yang mungkin sudah berjalan pada mesin yang sama) |
| `CONTAINER_TTL_HOURS` | Masa hidup container mahasiswa sebelum dihapus otomatis (default 24 jam) |

Daftar lengkap variabel beserta penjelasannya tersedia pada `.env.example`.

### 3. Build dan menjalankan

```bash
docker compose up -d --build
```

Perintah ini secara otomatis: build image `app`, menarik image `postgres:16-alpine`, menunggu PostgreSQL siap (healthcheck), kemudian menjalankan `app` (skema basis data diinisialisasi otomatis saat startup, dengan mekanisme retry apabila PostgreSQL belum sepenuhnya siap).

Verifikasi status:
```bash
docker compose ps
docker compose logs -f app
```

Log startup yang normal akan menampilkan konfirmasi koneksi basis data berhasil, hasil auto-detect host SSH, dan port yang digunakan aplikasi.

### 4. Seeding akun admin

```bash
docker compose exec app node scripts/seed.js
# atau: npm run docker:seed
```

**Catat kredensial admin yang ditampilkan** — apabila `ADMIN_PASSWORD` dikosongkan pada `.env`, password digenerate secara acak dan **hanya ditampilkan satu kali** pada output perintah ini. Perintah ini aman dijalankan berulang kali; akun admin yang sudah ada tidak akan ditimpa.

### 5. Build image container mahasiswa

Image ini berbeda dari image `app` — digunakan sebagai base image untuk container per-mahasiswa (Ubuntu + SSH + akses `sudo`). Karena `app` hanya mendelegasikan perintah ke Docker Engine host, image ini dibangun **langsung di host**, bukan di dalam container `app`:

```bash
chmod +x scripts/build-image.sh
./scripts/build-image.sh
```

Verifikasi: `docker images | grep praktikum-linux`.

### 6. Import daftar mahasiswa

Siapkan file CSV dengan kolom `nim,nama` (lihat `scripts/sample-students.csv` sebagai contoh format), lalu:

```bash
docker compose cp daftar-mahasiswa.csv app:/app/daftar-mahasiswa.csv
docker compose exec app node scripts/import-students.js daftar-mahasiswa.csv
```

Perintah ini aman dijalankan berulang kali — NIM yang sudah terdaftar akan dilewati, tidak menimpa password yang sudah diganti mahasiswa. Cocok dijalankan ulang setiap semester untuk menambahkan kelas baru.

### 7. Verifikasi akses

- Dashboard mahasiswa: `http://<ip-server>:3000/login`
- Dashboard admin: `http://<ip-server>:3000/admin/login`

Login mahasiswa menggunakan NIM dengan password default `12345678` (wajib diganti pada login pertama). Login admin menggunakan kredensial dari langkah 4.

---

## Operasional Sehari-hari

| Kebutuhan | Perintah |
|---|---|
| Melihat log aplikasi secara real-time | `docker compose logs -f app` atau `npm run docker:logs` |
| Restart seluruh service | `docker compose restart` |
| Stop seluruh service (data tetap tersimpan pada volume) | `docker compose down` atau `npm run docker:down` |
| Stop dan **hapus seluruh data basis data** (destruktif, gunakan dengan hati-hati) | `docker compose down -v` |
| Masuk ke shell container `app` | `docker compose exec app sh` |
| Masuk ke psql basis data | `docker compose exec db psql -U praktikum_user -d praktikum_db` |
| Menerapkan perubahan kode/konfigurasi | `docker compose up -d --build` |
| Import mahasiswa tambahan | `docker compose exec app node scripts/import-students.js <file>` |
| Reset akun admin (setelah hapus row di psql) | `docker compose exec app node scripts/seed.js` |

### Kebijakan Akses PostgreSQL

Port PostgreSQL sisi host (`DB_HOST_PORT`, default `5433`) hanya di-bind ke `127.0.0.1` (loopback), bukan ke seluruh antarmuka jaringan (`0.0.0.0`). Dengan konfigurasi ini, PostgreSQL tetap tidak dapat diakses dari jaringan kampus/LAN, namun tetap dapat dijangkau oleh proses lain pada mesin/VM yang sama — termasuk service `app` (karena menggunakan `network_mode: host`), maupun tool eksternal seperti DBeaver/pgAdmin untuk keperluan debugging langsung dari host.

### Update ke Versi Terbaru

```bash
git pull origin main
docker compose up -d --build
```

Skema basis data akan menyesuaikan otomatis (idempotent). Apabila terdapat perubahan pada struktur `docker-compose.yml` (misalnya penambahan environment variable baru), periksa `.env.example` untuk variabel yang mungkin perlu ditambahkan pada `.env` milik Anda.

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
docker compose logs -f app
# atau: npm run docker:logs

# Alternatif: tail langsung ke file (folder logs/ ter-mount ke host, lihat docker-compose.yml)
tail -f logs/combined-*.log
tail -f logs/error-*.log
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

### Build lambat atau bermasalah saat `docker compose up --build` di WSL

Karena seluruh instalasi dependency (`npm install`, termasuk native module seperti `bcrypt`) kini berjalan **di dalam container** saat build (lihat `Dockerfile`), masalah native module yang umum terjadi pada instalasi Node.js langsung di WSL sudah tidak relevan lagi pada alur ini. Namun, performa build tetap dapat melambat apabila repository berada pada drive Windows (`/mnt/c/...`, `/mnt/e/...`, dsb.) yang di-mount ke WSL — proses copy build context dari DrvFs (jembatan WSL↔NTFS) ke Docker lebih lambat dibandingkan filesystem native. Solusi: clone/pindahkan repository ke filesystem native WSL (`~/projects/...`) sebelum menjalankan `docker compose up --build`.

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
