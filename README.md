# 🐧 Platform Praktikum Linux — Container On-Demand

Platform penyediaan lingkungan Linux berbasis container untuk kebutuhan praktikum mahasiswa, dengan model self-service melalui browser. Browser hanya berfungsi sebagai **entry point** untuk provisioning; akses operasional tetap dilakukan mahasiswa melalui SSH dari terminal masing-masing. Setiap container memiliki masa hidup terbatas (TTL, default 24 jam) dan dihapus otomatis setelah kedaluwarsa.

📖 Dokumentasi terkait: **[docs/about-project.md](./docs/about-project.md)** (latar belakang proyek dan rasional keputusan teknis), **[docs/walkthrough.md](./docs/walkthrough.md)** (tinjauan fitur yang telah diimplementasikan), **[CHANGELOG.md](./CHANGELOG.md)** (riwayat perubahan), **[CONTRIBUTING.md](./CONTRIBUTING.md)** (panduan kontribusi), **[SECURITY.md](./SECURITY.md)** (kebijakan keamanan), dan **[AGENTS.md](./AGENTS.md)** (konvensi proyek untuk AI coding agent).

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

Riwayat perubahan lengkap ada di [CHANGELOG.md](./CHANGELOG.md).

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
├── docs/
│   ├── about-project.md                # Latar belakang proyek dan rasional keputusan teknis
│   └── walkthrough.md                  # Tinjauan fitur yang telah diimplementasikan
├── AGENTS.md                           # Panduan konvensi proyek untuk AI coding agent
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
│   │   ├── logService.js              # Pembacaan & parsing file log untuk admin panel
│   │   └── apiKeyService.js           # Generate/verifikasi/revoke API key (API Gateway)
│   ├── controllers/                   # Penanganan HTTP request/response
│   │   ├── authController.js
│   │   ├── containerController.js
│   │   ├── viewController.js
│   │   ├── adminController.js
│   │   └── apiV1Controller.js         # Handler untuk /api/v1/* (API Gateway)
│   ├── middleware/
│   │   ├── auth.js                    # Guard sesi mahasiswa
│   │   ├── adminAuth.js               # Guard sesi admin
│   │   ├── apiKeyAuth.js              # Guard API key untuk /api/v1/*
│   │   ├── i18n.js                    # Deteksi bahasa (cookie/query param) + fungsi t()
│   │   └── requestLogger.js           # Logging HTTP request + requestId untuk tracing
│   ├── routes/
│   │   ├── authRoutes.js              # /api/auth/*
│   │   ├── containerRoutes.js         # /api/containers/*
│   │   ├── viewRoutes.js              # Halaman: /login, /dashboard, /settings, dll.
│   │   ├── adminRoutes.js             # /admin/*
│   │   └── apiV1Routes.js             # /api/v1/* (API Gateway)
│   ├── i18n/
│   │   ├── en.json                    # Dictionary bahasa Inggris (default)
│   │   └── id.json                    # Dictionary bahasa Indonesia
│   ├── cron/cleanupJob.js             # Penghapusan otomatis container kedaluwarsa
│   └── utils/
│       ├── ServiceError.js            # Error class kustom antar layer
│       └── detectHost.js              # Auto-detect IP/host untuk SSH mahasiswa
├── logs/                              # File log (rotasi harian, isi di-gitignore)
├── views/                             # Template EJS (Tailwind via CDN)
│   ├── partials/
│   │   ├── head.ejs
│   │   ├── icon.ejs                   # SVG icon reusable (semua UI, tanpa emoji)
│   │   ├── lang-toggle.ejs            # Toggle bahasa EN/ID
│   │   └── password-field.ejs         # Input password dengan toggle visibilitas
│   ├── login.ejs
│   ├── change-password.ejs
│   ├── dashboard.ejs
│   ├── settings.ejs                   # Settings mahasiswa (password, bahasa)
│   └── admin/
│       ├── login.ejs
│       ├── dashboard.ejs              # Monitoring instance dan statistik penggunaan
│       ├── logs.ejs                   # Log viewer
│       └── settings.ejs               # Settings admin (password, bahasa, API key)
├── public/js/                         # Client-side script (termasuk notify.js - wrapper SweetAlert2)
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

Service `app` juga menggunakan `network_mode: host`, yang memungkinkan **auto-detect IP LAN server** untuk ditampilkan kepada mahasiswa tanpa konfigurasi manual (lihat `docs/about-project.md` untuk rasional lengkap). Pada Docker Desktop (Windows/Mac), mode ini kurang konsisten akibat perbedaan virtualisasi jaringan — apabila auto-detect tidak akurat, isi `SSH_HOST_DISPLAY` secara manual pada `.env`; nilai manual senantiasa diprioritaskan.

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

### Backup dan Restore Basis Data

```bash
npm run backup                          # backup manual, tersimpan di backups/
npm run restore backups/nama-file.sql.gz  # restore dari backup tertentu
```

`scripts/backup-db.sh` otomatis mendeteksi apakah dijalankan lewat Docker Compose (backup lewat `docker compose exec db pg_dump`) atau setup manual (backup langsung ke `PGHOST`/`PGUSER` dari `.env`). Backup lama dihapus otomatis setelah 14 hari (ubah lewat env `BACKUP_RETENTION_DAYS`).

**Untuk backup terjadwal otomatis**, tambahkan ke crontab di host (bukan di dalam container):
```bash
crontab -e
# Backup tiap hari jam 2 pagi:
0 2 * * * cd /path/ke/linux-praktikum && ./scripts/backup-db.sh >> logs/backup.log 2>&1
```

`scripts/restore-db.sh` meminta konfirmasi eksplisit sebelum menimpa data (proses ini destruktif — seluruh tabel di-drop dan dibuat ulang dari isi backup).

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
- **Tabel statistik penggunaan per mahasiswa**: total login, total container yang pernah dibuat, status aktif, waktu pembuatan container terakhir, dan opsi **reset password** mahasiswa (mahasiswa wajib ganti lagi di login berikutnya).
- **Log viewer** (`/admin/logs`): lihat bagian Monitoring dan Logging di atas.
- **Settings** (`/admin/settings`): ganti password admin sendiri, preferensi bahasa, dan manajemen API key (lihat bagian API Gateway di bawah).

---

## Settings / Personalisasi

Mahasiswa (`/settings`) dan admin (`/admin/settings`) punya halaman pengaturan masing-masing untuk:
- **Ganti password** kapan saja (tidak perlu menunggu dipaksa sistem seperti alur login pertama).
- **Preferensi bahasa** (EN/ID) — tersimpan ke akun (kolom `preferred_language`), bukan cuma cookie browser, jadi konsisten walau berpindah perangkat/browser.

Toggle bahasa cepat (EN/ID di pojok kanan atas tiap halaman) tetap tersedia untuk switch sesaat tanpa perlu ke halaman Settings — itu cuma menyimpan ke cookie, sedangkan pilihan di halaman Settings tersimpan permanen ke akun.

---

## API Gateway

Selain web UI (session-based), tersedia juga API terpisah di `/api/v1/*` untuk integrasi programatik dari sistem eksternal (mis. sinkronisasi data akademik), memakai autentikasi **API key** (bukan session cookie).

| Endpoint | Autentikasi | Deskripsi |
|---|---|---|
| `GET /api/v1/health` | Tidak perlu | Health check publik |
| `GET /api/v1/students` | `X-API-Key` wajib | Daftar mahasiswa (NIM, nama, status) - read-only |
| `GET /api/v1/containers` | `X-API-Key` wajib | Daftar container aktif - read-only |

**Kelola API key** lewat `/admin/settings`: generate key baru (ditampilkan sekali, mirip password container), lihat daftar key aktif beserta kapan terakhir dipakai, dan revoke kapan saja.

Contoh pemakaian:
```bash
curl -H "X-API-Key: plk_xxxxxxxxxxxxxxxxxxxxxxxx" http://<ip-server>:3000/api/v1/students
```

Karakteristik: read-only (tidak ada endpoint tulis/ubah data lewat API key pada tahap ini), rate limit 60 request/menit **per API key** (bukan per IP), key disimpan sebagai hash (`bcrypt`) bukan plaintext, dan response selalu berbahasa Inggris (tidak ikut sistem i18n web UI). Detail rasional desain ada di `docs/about-project.md`.

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
