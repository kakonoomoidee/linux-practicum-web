# 🚶 Walkthrough: Apa Saja yang Sudah Dibangun

Dokumen ini adalah tur fitur demi fitur dari platform ini — biar gampang inget apa yang udah ada dan di mana letak kodenya kalau mau diubah. Untuk alasan "kenapa" di balik keputusan desain, lihat `about-proyek.md`. Untuk cara menjalankan, lihat `README.md`.

---

## 1. Alur Mahasiswa

### 1.1 Login (`/login`)

- Login pakai **NIM + password**.
- Password default `12345678` untuk akun yang baru diimpor dari CSV elearning.
- Ada checkbox **"Ingat saya"** — kalau dicentang, session bertahan 30 hari alih-alih default (session pendek). Berguna untuk mahasiswa yang pakai laptop pribadi, sebaiknya TIDAK dicentang kalau pakai komputer lab bersama.
- Password field punya tombol **eye/eye-slash** untuk show/hide isi password saat mengetik.
- Rate-limited: maksimal 10 percobaan login per 15 menit per IP, mencegah brute-force.

**File terkait:** `views/login.ejs`, `public/js/login.js`, `src/controllers/authController.js`, `src/services/authService.js`.

### 1.2 Ganti Password Wajib (`/change-password`)

- Muncul otomatis kalau mahasiswa masih pakai password default (`first_login = true` di database).
- Password baru wajib minimal 8 karakter dan **tidak boleh sama** dengan password default.
- Semua field password (lama, baru, konfirmasi) punya toggle show/hide.
- Setelah berhasil, `first_login` di-set `false` dan mahasiswa diarahkan ke dashboard.

**File terkait:** `views/change-password.ejs`, `public/js/change-password.js`, `views/partials/password-field.ejs` (partial reusable untuk toggle).

### 1.3 Dashboard (`/dashboard`)

Ini halaman utama tempat mahasiswa mengelola container mereka.

- **Skeleton loading** ditampilkan (dengan animasi pulse) di 3 momen: saat halaman pertama kali memuat status container, saat proses "Buat Container" berlangsung, dan saat proses "Hapus Container" berlangsung. Ini mencegah tampilan terasa "diam/nge-freeze" saat menunggu proses Docker yang bisa memakan beberapa detik.
- **Buat Container** — kalau belum punya container aktif, tombol ini memicu provisioning container Linux baru. Setelah berhasil, ditampilkan: nama container, perintah SSH siap-pakai (dengan tombol copy), username, **password (cuma ditampilkan sekali di sini, tidak bisa dilihat lagi setelahnya)**, waktu dibuat, dan waktu kadaluarsa.
- **Hapus Container** — mahasiswa bisa hapus container mereka sendiri kapan saja, tidak perlu menunggu TTL habis.
- Logout tersedia di pojok kanan atas.

**File terkait:** `views/dashboard.ejs`, `public/js/dashboard.js`, `src/controllers/containerController.js`, `src/services/containerService.js`.

---

## 2. Alur Admin

### 2.1 Login Admin (`/admin/login`)

- Terpisah total dari login mahasiswa — tabel `admins` sendiri di database.
- Dibuat lewat `npm run seed`, bukan lewat form pendaftaran (memang disengaja, admin bukan self-service).

### 2.2 Dashboard Admin (`/admin`)

- **Summary cards**: total mahasiswa terdaftar, jumlah instance yang sedang aktif, total container yang pernah dibuat sepanjang waktu, jumlah login dalam 24 jam terakhir.
- **Tabel instance yang sedang berjalan**: NIM, nama mahasiswa, nama container, perintah SSH, waktu dibuat, waktu kadaluarsa, dan tombol **Hapus** untuk force-destroy tanpa perlu masuk ke database secara manual.
- **Tabel statistik pemakaian per mahasiswa**: total login, total container yang pernah dibuat, status aktif/tidak, dan kapan terakhir kali membuat container — berguna untuk melihat siapa yang benar-benar memakai platform ini dan siapa yang belum sama sekali.

**File terkait:** `views/admin/dashboard.ejs`, `src/controllers/adminController.js`, `src/services/adminService.js`, query gabungan ada di `src/repositories/containerRepository.js` (`findAllRunningWithStudent`, `getUsageStatsPerStudent`, `getSummaryStats`).

---

## 3. Provisioning Container (Inti Sistem)

Ini bagian paling kompleks dari sistem, ada di `src/services/containerService.js` dan `src/services/dockerService.js`.

### 3.1 Apa yang terjadi saat mahasiswa klik "Buat Container"

1. Sistem cek: apakah mahasiswa ini sudah punya container berstatus `running` di database?
2. **Kalau ada** → sistem verifikasi LANGSUNG ke Docker Engine, apakah container itu beneran masih hidup:
   - Masih hidup → ditolak dengan pesan jelas.
   - **Sudah tidak ada di Docker** (dihapus manual, crash, dll) → record lama otomatis ditandai `destroyed`, mahasiswa langsung bisa lanjut. Ini fitur **self-healing** (lihat `about-proyek.md` untuk detail kenapa ini penting).
   - Docker Engine tidak bisa dihubungi sama sekali → sistem **tidak** menghapus record apa pun (mencegah kesalahan), kasih pesan error yang jelas.
3. Container baru dibuat di Docker dengan:
   - Base image `praktikum-linux:latest` (dibangun dari `docker/Dockerfile.student`)
   - Port SSH acak dari range yang ditentukan (`SSH_PORT_MIN`–`SSH_PORT_MAX`)
   - Password Linux acak (10 karakter)
   - Resource limit: memory, CPU, disk quota, `PidsLimit: 256` (anti fork-bomb)
   - Network terisolasi (`enable_icc=false`) sehingga tidak bisa akses container mahasiswa lain
4. Kalau container berhasil dibuat di Docker tapi **gagal disimpan ke database**, sistem otomatis **rollback**: container yang baru dibuat langsung dihapus lagi dari Docker, supaya tidak ada container "orphan" yang jalan tanpa tercatat.

### 3.2 Auto-cleanup (TTL)

- Cron job (`src/cron/cleanupJob.js`) berjalan tiap 10 menit (bisa diatur lewat `CLEANUP_CRON_PATTERN`), mencari semua container yang `expires_at`-nya sudah lewat, lalu menghapusnya dari Docker dan menandai `destroyed` di database.
- Kalau penghapusan di Docker gagal (misal container sudah tidak ada), status di database tetap ditandai `destroyed` supaya tidak nyangkut selamanya.

### 3.3 Image Container Mahasiswa

- `docker/Dockerfile.student` — Ubuntu 22.04 + `openssh-server` + tools dasar (git, python3, node, build-essential, vim, dll).
- `docker/entrypoint.sh` — dijalankan saat container start, membuat user `mahasiswa` dengan password dari environment variable (dikirim saat provisioning), memberi akses `sudo` penuh (`NOPASSWD:ALL`), lalu menjalankan `sshd`.
- Build manual sekali via `scripts/build-image.sh` — ini **beda** dari image `app` (web app-nya sendiri), dan dibangun langsung di host tempat Docker Engine berjalan.

---

## 4. Infrastruktur & Deployment

### 4.1 Docker Compose

- `docker-compose.yml` mendefinisikan 2 service: `app` (web app) dan `db` (PostgreSQL 16).
- Service `db` **tidak** expose port ke host secara default (lebih aman, hanya bisa diakses dari dalam Docker network internal oleh `app`).
- Service `app` mount `/var/run/docker.sock` dari host — ini yang memungkinkan app "mengontrol" Docker Engine host untuk membuat container mahasiswa (pola *sibling containers*).
- `Dockerfile` untuk `app` pakai multi-stage build: stage pertama install dependency dengan compiler (buat native module seperti `bcrypt`), stage kedua cuma bawa hasil `node_modules` tanpa compiler (image lebih kecil).

### 4.2 Database

- Schema didefinisikan di `src/db/schema.sql`, dijalankan otomatis (idempotent, `CREATE TABLE IF NOT EXISTS`) setiap kali app start — jadi tidak perlu migration tool terpisah.
- Server melakukan **retry otomatis** kalau koneksi ke database gagal saat startup (berguna untuk kondisi race saat `docker compose up` pertama kali, sebelum PostgreSQL benar-benar siap).
- Session (login) disimpan di tabel `session` PostgreSQL (via `connect-pg-simple`), bukan in-memory — jadi session tidak hilang saat app di-restart, dan tidak menyebabkan memory leak.

### 4.3 Seed & Import Data

- `scripts/seed.js` — membuat akun admin pertama kali. **Aman dijalankan berkali-kali**: kalau akun admin sudah ada, tidak akan ditimpa. Kalau `ADMIN_PASSWORD` di `.env` dikosongkan, password di-generate acak (16 karakter, aman) dan ditampilkan **satu kali saja** di terminal.
- `scripts/import-students.js` — import daftar mahasiswa dari CSV (`nim,nama`) hasil export elearning. NIM yang sudah ada di-skip (tidak menimpa password yang sudah diganti mahasiswa), jadi aman dijalankan ulang tiap semester untuk kelas baru.

---

## 5. Keamanan yang Sudah Diterapkan

Ringkasan (detail lengkap ada di README bagian "Keamanan yang diterapkan"):

- Password web & Linux di-hash `bcrypt`, tidak pernah disimpan plaintext.
- Session `httpOnly` cookie, disimpan di PostgreSQL.
- Rate limiting login (mahasiswa & admin).
- Container: `CapDrop: ALL`, capability minimal, `PidsLimit`, resource limit, `no-new-privileges`.
- Network container terisolasi antar mahasiswa.
- Akses platform dibatasi ke jaringan kampus (bukan expose ke internet publik) — dikonfigurasi di level firewall kampus, di luar kode aplikasi ini.

---

## 6. Yang Belum Dikerjakan / Perlu Setup Manual di Luar Kode

- Firewall kampus (allow port dashboard & range SSH hanya dari subnet kampus).
- Rate-limit outbound traffic per container (`tc`/`iptables`).
- Monitoring resource untuk deteksi anomali (mining, dll).
- HTTPS via reverse proxy kalau nanti diakses lewat domain internal.
- Backup PostgreSQL berkala.

Lihat bagian "Roadmap" di `about-proyek.md` untuk ide pengembangan yang belum dikerjakan.
