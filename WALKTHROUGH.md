# 🚶 Walkthrough Fitur

Dokumen ini memberikan tinjauan sistematis terhadap fitur-fitur yang telah diimplementasikan pada platform, beserta referensi lokasi kode terkait untuk memudahkan navigasi saat melakukan perubahan. Rasional di balik keputusan desain dapat ditemukan pada `about-proyek.md`. Panduan operasional (instalasi, deployment) tersedia pada `README.md`.

---

## 1. Alur Mahasiswa

### 1.1 Login (`/login`)

- Autentikasi menggunakan kombinasi **NIM dan password**.
- Password default `12345678` diberlakukan untuk akun yang baru diimpor dari CSV elearning.
- Tersedia opsi **"Ingat saya"** — apabila dicentang, sesi diperpanjang hingga 30 hari (default: durasi sesi lebih pendek). Direkomendasikan untuk tidak diaktifkan pada perangkat bersama (laboratorium komputer).
- Field password dilengkapi kontrol visibilitas (toggle show/hide).
- Endpoint login menerapkan rate limiting: maksimal 10 percobaan per 15 menit per alamat IP, sebagai mitigasi terhadap serangan brute-force.

**Referensi berkas:** `views/login.ejs`, `public/js/login.js`, `src/controllers/authController.js`, `src/services/authService.js`.

### 1.2 Penggantian Password Wajib (`/change-password`)

- Ditampilkan secara otomatis apabila mahasiswa masih menggunakan password default (`first_login = true` pada basis data).
- Password baru wajib memenuhi panjang minimal 8 karakter dan tidak boleh identik dengan password default.
- Seluruh field password (lama, baru, konfirmasi) dilengkapi kontrol visibilitas.
- Setelah berhasil, flag `first_login` diubah menjadi `false` dan mahasiswa diarahkan ke dashboard.

**Referensi berkas:** `views/change-password.ejs`, `public/js/change-password.js`, `views/partials/password-field.ejs` (komponen reusable untuk toggle visibilitas).

### 1.3 Dashboard (`/dashboard`)

Halaman utama pengelolaan container mahasiswa.

- **Skeleton loading** ditampilkan pada tiga kondisi: pemuatan status container awal, proses pembuatan container, dan proses penghapusan container — mengurangi persepsi "diam" pada antarmuka selama proses Docker berlangsung (dapat memakan waktu beberapa detik).
- **Pembuatan container** — memicu provisioning container Linux baru apabila mahasiswa belum memiliki instance aktif. Setelah berhasil, sistem menampilkan nama container, perintah SSH siap pakai (dengan fungsi copy-to-clipboard), username, **password (ditampilkan satu kali, tidak dapat diakses kembali setelahnya)**, waktu pembuatan, dan waktu kedaluwarsa.
- **Penghapusan container** — mahasiswa dapat menghapus container mereka sendiri kapan saja tanpa perlu menunggu TTL habis.
- Fungsi logout tersedia pada bagian kanan atas antarmuka.

**Referensi berkas:** `views/dashboard.ejs`, `public/js/dashboard.js`, `src/controllers/containerController.js`, `src/services/containerService.js`.

---

## 2. Alur Administrator

### 2.1 Login Admin (`/admin/login`)

- Sepenuhnya terpisah dari sistem login mahasiswa, menggunakan tabel `admins` tersendiri pada basis data.
- Akun dibuat melalui `npm run seed`, bukan melalui form pendaftaran — desain ini disengaja karena akun admin bukan bersifat self-service.

### 2.2 Dashboard Admin (`/admin`)

- **Ringkasan statistik**: total mahasiswa terdaftar, jumlah instance aktif, total container yang pernah dibuat sepanjang waktu, jumlah login dalam 24 jam terakhir.
- **Tabel instance aktif**: NIM, nama mahasiswa, nama container, perintah SSH, waktu pembuatan, waktu kedaluwarsa, dan opsi force-delete tanpa memerlukan akses langsung ke basis data.
- **Tabel statistik penggunaan per mahasiswa**: total login, total container yang pernah dibuat, status aktif, dan waktu pembuatan container terakhir — memberikan visibilitas terhadap tingkat adopsi platform di kalangan mahasiswa.

**Referensi berkas:** `views/admin/dashboard.ejs`, `src/controllers/adminController.js`, `src/services/adminService.js`; query gabungan terdapat pada `src/repositories/containerRepository.js` (`findAllRunningWithStudent`, `getUsageStatsPerStudent`, `getSummaryStats`).

### 2.3 Log Viewer (`/admin/logs`)

- Menampilkan log aplikasi langsung pada antarmuka admin, tanpa memerlukan akses terminal ke server.
- Filter tersedia berdasarkan level log (`error`, `warn`, `info`, `http`, `debug`), kata kunci pencarian bebas (NIM, pesan, nama event, request ID), dan jumlah baris yang ditampilkan (100–1000).
- Membaca maksimal tiga file log terakhir per kategori (kombinasi seluruh level, atau khusus error) untuk menjaga performa.

**Referensi berkas:** `views/admin/logs.ejs`, `src/services/logService.js`, `src/controllers/adminController.js` (fungsi `logsPage`).

---

## 3. Provisioning Container

Komponen inti sistem, terletak pada `src/services/containerService.js` dan `src/services/dockerService.js`.

### 3.1 Alur Pembuatan Container

1. Sistem memeriksa apakah mahasiswa terkait sudah memiliki container berstatus `running` pada basis data.
2. **Apabila ditemukan**, sistem melakukan verifikasi langsung ke Docker Engine untuk memastikan status aktual:
   - Container masih berjalan → permintaan ditolak dengan pesan yang informatif.
   - Container sudah tidak ada di Docker Engine (dihapus manual, crash, dsb.) → record lama otomatis ditandai `destroyed`, mahasiswa dapat langsung melanjutkan. Mekanisme ini disebut **self-healing** (lihat `about-proyek.md` untuk rasional lengkap).
   - Docker Engine tidak dapat dihubungi sama sekali → sistem **tidak** menghapus record apa pun (mencegah kesalahan data), dan mengembalikan pesan error yang jelas.
3. Container baru dibuat pada Docker Engine dengan konfigurasi:
   - Base image `praktikum-linux:latest` (dibangun dari `docker/Dockerfile.student`)
   - Port SSH acak dari rentang yang ditentukan (`SSH_PORT_MIN`–`SSH_PORT_MAX`)
   - Password Linux acak (10 karakter)
   - Resource limit: memory, CPU, disk quota, `PidsLimit: 256` (mitigasi fork-bomb)
   - Isolasi jaringan (`enable_icc=false`) sehingga tidak dapat mengakses container mahasiswa lain
4. Apabila container berhasil dibuat pada Docker Engine namun **gagal disimpan ke basis data**, sistem melakukan **rollback otomatis**: container yang baru dibuat langsung dihapus kembali, mencegah munculnya container "orphan" yang berjalan tanpa tercatat.

### 3.2 Pembersihan Otomatis (TTL)

- Cron job (`src/cron/cleanupJob.js`) berjalan setiap 10 menit (dapat diatur melalui `CLEANUP_CRON_PATTERN`), mencari seluruh container yang `expires_at`-nya telah terlampaui, kemudian menghapusnya dari Docker dan menandai `destroyed` pada basis data.
- Apabila penghapusan pada Docker gagal (misalnya container sudah tidak ada), status pada basis data tetap ditandai `destroyed` untuk mencegah record tersangkut secara permanen.

### 3.3 Image Container Mahasiswa

- `docker/Dockerfile.student` — berbasis Ubuntu 22.04 dengan `openssh-server` dan tools dasar (git, python3, node, build-essential, vim, dsb.).
- `docker/entrypoint.sh` — dieksekusi saat container start, membuat user `mahasiswa` dengan password dari environment variable (dikirim saat provisioning), memberikan akses `sudo` penuh (`NOPASSWD:ALL`), kemudian menjalankan `sshd`.
- Dibangun secara terpisah melalui `scripts/build-image.sh` — berbeda dari image `app`, dan dibangun langsung pada host tempat Docker Engine berjalan.

### 3.4 Auto-Detect Host untuk SSH

`src/utils/detectHost.js` menentukan IP/host yang ditampilkan kepada mahasiswa pada dashboard, dengan urutan prioritas:

1. `SSH_HOST_DISPLAY` pada `.env` — apabila diisi manual, senantiasa diprioritaskan.
2. Deteksi lingkungan WSL (variabel `WSL_DISTRO_NAME` tersedia) → menggunakan `localhost` (memanfaatkan fitur port forwarding otomatis WSL2 ke Windows).
3. Server Linux reguler → memindai antarmuka jaringan, memilih alamat IPv4 LAN yang paling sesuai.
4. Fallback ke `127.0.0.1` apabila seluruh mekanisme di atas gagal, disertai peringatan eksplisit pada log server.

Hasil deteksi beserta sumbernya dicatat pada log saat startup server (`SSH host mahasiswa : <host> [<sumber>]`), memungkinkan verifikasi cepat oleh administrator tanpa perlu membaca kode sumber.

**Referensi berkas:** `src/utils/detectHost.js`, `src/config/env.js`, `server.js` (logging saat startup).

---

## 4. Infrastruktur dan Deployment

### 4.1 Docker Compose

- `docker-compose.yml` mendefinisikan dua service: `app` (aplikasi web) dan `db` (PostgreSQL 16).
- Port service `db` di-bind hanya ke `127.0.0.1` (loopback), bukan ke `0.0.0.0` — tetap tidak dapat diakses dari LAN kampus, namun dapat diakses oleh `app` yang berjalan pada network host yang sama. Port sisi host dapat dikonfigurasi melalui `DB_HOST_PORT` (default `5433`) untuk menghindari konflik dengan instance PostgreSQL lain.
- Service `app` menggunakan `network_mode: host` — memungkinkan aplikasi mengenali antarmuka jaringan asli milik host (digunakan untuk auto-detect IP SSH, lihat bagian 3.4) — dan memasang `/var/run/docker.sock` dari host, memungkinkan `app` mengendalikan Docker Engine host untuk provisioning container mahasiswa (pola *sibling containers*).
- `Dockerfile` untuk `app` menggunakan multi-stage build: tahap pertama melakukan instalasi dependency dengan compiler (untuk native module seperti `bcrypt`), tahap kedua hanya membawa hasil `node_modules` tanpa compiler, menghasilkan image yang lebih ringkas.
- Seluruh konfigurasi pada `docker-compose.yml` bersumber dari environment variable dengan default yang aman — tidak terdapat nilai hardcoded.

### 4.2 Basis Data

- Skema didefinisikan pada `src/db/schema.sql`, dieksekusi otomatis (idempotent, `CREATE TABLE IF NOT EXISTS`) setiap kali aplikasi start — menghilangkan kebutuhan tool migrasi terpisah.
- Server menerapkan mekanisme **retry otomatis** apabila koneksi ke basis data gagal saat startup (relevan untuk kondisi race pada eksekusi pertama `docker compose up`, sebelum PostgreSQL sepenuhnya siap menerima koneksi).
- Sesi (login) disimpan pada tabel `session` PostgreSQL (melalui `connect-pg-simple`), bukan in-memory — mencegah kehilangan sesi saat aplikasi di-restart dan menghindari risiko memory leak.

### 4.3 Seeding dan Import Data

- `scripts/seed.js` — membuat akun admin pada eksekusi pertama. Aman dijalankan berulang kali: akun admin yang sudah ada tidak akan ditimpa. Apabila `ADMIN_PASSWORD` pada `.env` dikosongkan, password digenerate secara acak (16 karakter) dan hanya ditampilkan satu kali pada terminal.
- `scripts/import-students.js` — mengimpor daftar mahasiswa dari CSV (`nim,nama`) hasil ekspor elearning. NIM yang sudah terdaftar akan dilewati (tidak menimpa password yang sudah diganti mahasiswa), sehingga aman dijalankan ulang setiap semester untuk kelas baru.

### 4.4 Logging dan Monitoring

- **`src/config/logger.js`** — instance Winston terpusat, digunakan pada seluruh layer aplikasi (services, controllers, cron, db). Format JSON untuk file dan console produksi; format berwarna untuk console pengembangan.
- **`src/middleware/requestLogger.js`** — mencatat setiap HTTP request yang masuk (method, path, status, durasi, IP, NIM), dengan `requestId` unik per request (dikembalikan melalui header `X-Request-Id`) untuk mempermudah tracing pada laporan error.
- **`src/services/logService.js`** — membaca dan mem-parsing file log untuk keperluan log viewer pada admin panel, dengan dukungan filter level, pencarian, dan pembatasan jumlah baris.
- File log tersimpan pada `logs/`, terpisah menjadi `error-YYYY-MM-DD.log` (khusus level error) dan `combined-YYYY-MM-DD.log` (seluruh level), dengan rotasi harian otomatis dan retensi 14 hari.
- Pada Docker Compose, direktori `logs/` dipasang sebagai volume (`./logs:/app/logs`) — log tetap persisten meskipun container di-restart/rebuild, dan dapat diakses langsung (`tail`) dari host tanpa perlu masuk ke dalam container.
- Log signifikan memiliki field `event` yang konsisten (`container_created`, `container_self_heal`, `container_rollback`, `container_orphan_warning`, `admin_login_success`, `student_login_failed`, dsb.) — memudahkan proses filtering dan siap diintegrasikan dengan tooling monitoring (ELK, Grafana Loki, dsb.) karena format JSON yang konsisten.
- Seluruh pemanggilan `console.log`/`console.error` yang sebelumnya tersebar pada berbagai berkas telah dimigrasikan ke logger terpusat ini.

**Referensi berkas:** `src/config/logger.js`, `src/middleware/requestLogger.js`, `src/services/logService.js`. Lihat juga README bagian "Monitoring dan Logging" untuk panduan penggunaan sehari-hari.

---

## 5. Kebijakan Keamanan yang Diterapkan

Ringkasan (detail lengkap tersedia pada README bagian "Kebijakan Keamanan"):

- Password web dan Linux di-hash menggunakan `bcrypt`, tidak pernah disimpan dalam bentuk plaintext.
- Sesi menggunakan cookie `httpOnly`, disimpan pada PostgreSQL.
- Rate limiting pada endpoint login (mahasiswa dan admin).
- Container: `CapDrop: ALL`, capability minimal, `PidsLimit`, resource limit, `no-new-privileges`.
- Isolasi jaringan antar-container mahasiswa.
- Akses platform dibatasi ke jaringan kampus (tidak diekspos ke internet publik) — dikonfigurasi pada level firewall kampus, di luar cakupan kode aplikasi ini.
- Pengaturan `trust proxy` menggunakan nilai eksplisit (`TRUST_PROXY_HOPS`) untuk mencegah risiko spoofing header IP pada mekanisme rate limiting.

---

## 6. Cakupan di Luar Kode / Belum Diimplementasikan

- Konfigurasi firewall kampus (pembatasan akses port dashboard dan rentang port SSH hanya dari subnet kampus).
- Rate-limiting outbound traffic per container (`tc`/`iptables`).
- Monitoring resource untuk deteksi anomali penggunaan (mis. cryptomining).
- HTTPS melalui reverse proxy apabila diakses melalui domain internal.
- Backup PostgreSQL berkala.

Lihat bagian "Roadmap" pada `about-proyek.md` untuk gagasan pengembangan lanjutan yang belum diimplementasikan.
