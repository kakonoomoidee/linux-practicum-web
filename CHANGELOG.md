# Changelog

Semua perubahan signifikan pada proyek ini didokumentasikan di file ini. Format mengikuti konvensi [Keep a Changelog](https://keepachangelog.com/), penomoran versi mengikuti [Semantic Versioning](https://semver.org/) secara longgar (proyek internal, bukan package yang dipublikasikan).

## [Unreleased]

### Ditambahkan
- Fitur Settings/Personalize untuk mahasiswa dan admin (ganti password kapan saja, preferensi bahasa tersimpan ke akun).
- API Gateway (`/api/v1/*`) dengan autentikasi API key, untuk integrasi programatik dari sistem lain.
- Struktur dokumentasi proyek dipindah ke folder `docs/`, ditambah `AGENTS.md`, `CONTRIBUTING.md`, `SECURITY.md`, `LICENSE`, template issue/PR GitHub.

## [4.2] - 2026-08-15

### Ditambahkan
- Halaman **Log Server** pada admin panel (`/admin/logs`) — administrator dapat meninjau log aplikasi langsung dari browser, dengan filter berdasarkan level, kata kunci, dan jumlah baris.

### Diubah
- Seluruh konfigurasi Docker Compose kini bersumber dari variabel environment, termasuk port PostgreSQL sisi host (`DB_HOST_PORT`) — menghindari konflik dengan instance PostgreSQL lain yang mungkin sudah berjalan di port default 5432.

### Diperbaiki
- Pengaturan `trust proxy` tidak lagi menggunakan nilai `true` (rentan terhadap spoofing IP), digantikan variabel `TRUST_PROXY_HOPS` yang eksplisit.

## [4.1] - 2026-08-14

### Ditambahkan
- **Structured logging** menggunakan Winston — level log mengikuti konvensi industri (`error`/`warn`/`info`/`http`/`debug`), format JSON untuk file dan console produksi, format berwarna untuk console pengembangan.
- **Request logging** — setiap HTTP request memperoleh `requestId` unik untuk keperluan tracing, dicatat beserta method, path, status, durasi, IP, dan NIM (jika terautentikasi).
- **Rotasi file log otomatis** — `logs/error-YYYY-MM-DD.log` (khusus level error) dan `logs/combined-YYYY-MM-DD.log` (seluruh level), rotasi harian dengan retensi 14 hari, dipasang sebagai volume pada Docker Compose.

### Diubah
- Seluruh pemanggilan `console.log`/`console.error` pada codebase dimigrasikan ke logger terstruktur.

## [4.0] - 2026-08-14

### Ditambahkan
- **Auto-detect host SSH** — variabel `SSH_HOST_DISPLAY` tidak lagi wajib diisi manual. Sistem otomatis menggunakan `localhost` saat berjalan di WSL, atau memindai antarmuka jaringan pada server Linux.
- **Remember me** pada login — sesi dapat diperpanjang hingga 30 hari.
- **Toggle visibilitas password** pada seluruh field password.
- **Skeleton loading** pada dashboard selama proses pemuatan status, pembuatan, dan penghapusan container.
- Dokumentasi proyek: `docs/about-project.md` dan `docs/walkthrough.md` (saat itu masih di root, dipindah ke `docs/` pada versi Unreleased).

## [3.0] - 2026-08-13

### Diubah
- Migrasi ke **layered architecture** (Controller → Service → Repository).
- Migrasi basis data dari SQLite ke **PostgreSQL**.
- Migrasi frontend ke **EJS** (server-rendered) dengan **Tailwind CSS**, menggantikan SPA client-side yang sebelumnya menyebabkan bug pada input password.
- Sesi disimpan pada PostgreSQL (bukan in-memory).

### Ditambahkan
- **Admin panel** — pemantauan instance aktif dan statistik penggunaan per mahasiswa.
- **Self-healing container**: sistem mendeteksi dan membersihkan otomatis record container yang tidak sinkron dengan Docker Engine, menghilangkan kebutuhan intervensi manual pada basis data.
- Orkestrasi deployment melalui **Docker Compose**.

## [2.0] - 2026-08-12

### Ditambahkan
- Provisioning container Linux on-demand pertama kali, berbasis Express + SQLite + Docker (dockerode).
- Login mahasiswa dengan NIM + password default, wajib ganti password di login pertama.
- Self-service create/destroy container dengan batas 1 container aktif per mahasiswa, TTL 24 jam.

---

Untuk konteks lebih lengkap di balik setiap keputusan teknis pada versi-versi di atas, lihat `docs/about-project.md`.
