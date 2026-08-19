# Kebijakan Keamanan

## Ruang Lingkup Keamanan Proyek Ini

Platform ini dirancang untuk dijalankan secara eksklusif pada **jaringan kampus/LAN tertutup**, bukan diekspos ke internet publik. Sebagian besar model keamanannya mengasumsikan konteks tersebut. Lihat `docs/about-project.md` bagian "Keputusan Teknis dan Rasional" untuk penjelasan lengkap batasan yang ditetapkan secara sengaja.

## Melaporkan Kerentanan Keamanan

Kalau menemukan celah keamanan pada proyek ini (bukan sekadar bug fungsional biasa - gunakan [issue template Bug Report](.github/ISSUE_TEMPLATE/bug_report.md) untuk itu), mohon **jangan** membuka issue publik terlebih dahulu. Sebagai gantinya:

1. Hubungi maintainer proyek secara langsung (lihat bagian Kontributor pada `docs/about-project.md`).
2. Sertakan deskripsi kerentanan, langkah reproduksi, dan potensi dampaknya.
3. Beri waktu yang wajar untuk perbaikan sebelum pengungkapan publik.

## Area yang Perlu Perhatian Ekstra

Beberapa bagian sistem yang secara sengaja diberi akses istimewa dan perlu dipahami risikonya sebelum diubah:

- **Docker socket mounting** (`docker-compose.yml`, service `app`): container `app` memiliki akses penuh ke Docker Engine milik host lewat `/var/run/docker.sock`. Ini disengaja (pola *sibling containers*, lihat `docs/about-project.md`), tapi berarti kompromi terhadap container `app` secara efektif setara kompromi terhadap host Docker Engine. Jangan expose port aplikasi `app` ke internet publik.
- **Akses `sudo` mahasiswa** di dalam container mereka masing-masing: ini disengaja untuk tujuan pembelajaran, dimitigasi lewat isolasi infrastruktur (`CapDrop: ALL` + capability minimal, resource limit, isolasi jaringan antar-container). Lihat `src/services/dockerService.js` untuk detail konfigurasi.
- **API Gateway** (`/api/v1/*`, kalau sudah diimplementasikan): endpoint ini memakai autentikasi API key terpisah dari sesi login web. API key **tidak pernah** disimpan plaintext di database - hanya hash yang disimpan, nilai asli hanya ditampilkan sekali saat pembuatan key. Cabut (revoke) API key yang sudah tidak dipakai lewat admin panel.

## Praktik yang Sudah Diterapkan

- Password (akun web maupun Linux mahasiswa) di-hash dengan `bcrypt`, tidak pernah disimpan plaintext.
- Rate limiting pada endpoint login (mahasiswa, admin) dan API gateway.
- Sesi disimpan di PostgreSQL dengan cookie `httpOnly`.
- Pengaturan `trust proxy` eksplisit (`TRUST_PROXY_HOPS`), tidak memakai `true` yang rentan spoofing header IP.

Detail lengkap ada di `README.md` bagian "Kebijakan Keamanan" dan `docs/walkthrough.md` bagian "Kebijakan Keamanan yang Diterapkan".
