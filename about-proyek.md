# 📖 Tentang Proyek: Praktikum Linux — Container On-Demand

Dokumen ini adalah **source of truth** buat proyek ini — kenapa proyek ini dibikin, keputusan teknis apa aja yang diambil dan alasannya, serta batasan yang disengaja. Kalau ada pertanyaan "kenapa X dibikin gini bukan gitu", jawabannya harusnya ada di sini.

---

## Latar Belakang

Mahasiswa di kelas praktikum Linux (jaringan/TI) sering kesulitan setup environment Linux sendiri:
- Laptop dengan spek rendah ("kentang") sering ga kuat / ga bisa jalanin WSL2 atau VM lokal (VirtualBox, dll) — butuh virtualization di BIOS yang kadang ga aktif atau ga didukung.
- Install WSL2 + distro Linux itu berat dari sisi storage dan bandwidth buat mahasiswa dengan koneksi internet terbatas.
- Environment yang beda-beda antar laptop mahasiswa bikin masalah "di laptop saya kerja, di laptop teman saya error" yang menyita waktu praktikum.

**Solusinya:** mahasiswa cukup buka browser dari jaringan kampus, klik "Buat Container", dan dapat akses SSH ke Linux environment yang seragam untuk semua orang — tanpa install apa pun di laptop mereka selain terminal bawaan OS.

---

## Tujuan Proyek

1. Mahasiswa bisa "minjem" container Linux penuh (akses `sudo`, bisa install apa saja) dari browser, tanpa instalasi lokal.
2. Environment seragam untuk semua mahasiswa — mengurangi masalah "works on my machine".
3. Self-service — mahasiswa ga perlu nunggu asisten dosen buat provisioning manual.
4. Aman buat dijalankan di server kampus tanpa membahayakan sistem lain di jaringan yang sama.

## Yang BUKAN Tujuan Proyek Ini (Batasan yang Disengaja)

- **Bukan** pengganti VPS/cloud publik — didesain khusus buat diakses dari jaringan kampus, bukan dari internet umum.
- **Bukan** platform multi-tenant skala besar — target penggunanya mahasiswa satu jurusan/kelas, bukan ribuan orang sekaligus.
- **Bukan** sandbox yang 100% tahan dari penyalahgunaan disengaja — mahasiswa punya akses `sudo` penuh di dalam container mereka, jadi proyek ini mengandalkan **isolasi di level infrastruktur** (network, resource limit), bukan restriksi command di dalam container.

---

## Keputusan Teknis & Alasannya

### Kenapa akses dibatasi hanya dari jaringan kampus (bukan VPN/public internet)?

Kampus (UMY) belum/tidak menyediakan VPN untuk mahasiswa. Daripada expose port SSH ke internet publik (risiko keamanan besar — bot scanning port SSH itu masif dan terus-menerus), platform ini didesain untuk **hanya reachable dari LAN/WiFi kampus**. Trade-off-nya: mahasiswa ga bisa praktikum dari rumah/kost, harus di kampus. Ini keputusan sadar demi keamanan, bukan keterbatasan teknis yang belum sempat diperbaiki.

### Kenapa container di-set TTL 24 jam (auto-hapus)?

Supaya resource server ga habis dimakan container yang lupa dihapus mahasiswa. Ini juga mendorong mahasiswa buat push/simpan pekerjaan mereka ke tempat lain (git, dsb) daripada menyimpan semuanya cuma di container sementara.

### Kenapa 1 container per mahasiswa?

Sederhana buat dikelola dan mencegah satu mahasiswa memonopoli resource server dengan bikin banyak container sekaligus. Bisa diubah lewat `MAX_CONTAINER_PER_STUDENT` di `.env` kalau kebutuhannya berubah.

### Kenapa mahasiswa dapat akses `sudo` penuh di dalam container?

Tujuan praktikumnya memang belajar administrasi Linux — install package, konfigurasi service, dll. Membatasi `sudo` akan menghilangkan poin utama pembelajarannya. Sebagai gantinya, **isolasi dilakukan di level infrastruktur**:
- `CapDrop: ALL` + capability minimal (bukan container `--privileged`)
- `PidsLimit: 256` (cegah fork bomb menghabiskan resource host)
- Resource limit (memory, CPU, disk quota) per container
- Network terisolasi antar container (`enable_icc=false`) — mahasiswa A tidak bisa menyerang container mahasiswa B
- `no-new-privileges` security flag aktif

### Kenapa autentikasi pakai NIM + password default, bukan SSO kampus?

Integrasi SSO kampus (SIM/portal UMY) butuh koordinasi dengan pihak IT kampus yang di luar kendali proyek ini di tahap awal. Solusi sementara: import daftar NIM+nama dari export CSV elearning (Moodle), password default `12345678`, **wajib diganti** di login pertama sebelum bisa akses fitur apa pun. Ini pola yang familier untuk banyak sistem kampus (mirip aktivasi akun baru).

### Kenapa arsitektur Docker-nya "sibling containers" (bukan Docker-in-Docker beneran)?

Container `app` di-mount Docker socket host (`/var/run/docker.sock`), bukan menjalankan Docker daemon terpisah di dalam dirinya sendiri (true DinD). Alasan:
- Docker-in-Docker beneran itu kompleks, sering bermasalah dengan storage driver, dan butuh privileged mode yang justru lebih riskan.
- Pola "sibling" (app numpang ke Docker Engine host) lebih stabil dan merupakan pattern yang umum dipakai untuk aplikasi yang perlu mengorkestrasi container lain (mirip cara kerja Portainer, dsb).
- Konsekuensinya: container mahasiswa yang dibuat itu jadi *sibling* dari container `app`, portnya di-bind langsung ke host — makanya `SSH_HOST_DISPLAY` tetap harus IP LAN server, bukan nama service Docker Compose.

### Kenapa PostgreSQL, bukan SQLite (versi awal proyek ini pakai SQLite)?

Versi pertama proyek ini pakai `better-sqlite3`, tapi native module ini rewel banget di WSL kalau project-nya ditaruh di drive Windows (`/mnt/e/...` alih-alih filesystem native WSL) — sering crash pas load karena masalah ABI/filesystem. PostgreSQL lebih robust untuk kebutuhan ini, juga lebih natural untuk dijalankan sebagai service terpisah di Docker Compose, dan skalanya lebih siap kalau nanti dipakai beberapa kelas/mata kuliah sekaligus.

### Kenapa "self-healing" container jadi fitur eksplisit?

Di versi awal, kalau container di Docker dihapus manual/crash tapi record di database masih bilang `'running'`, mahasiswa akan **terus-menerus ditolak** bikin container baru (karena sistem mengira mereka masih punya 1 container aktif) — satu-satunya solusi waktu itu adalah admin hapus row itu manual di database. Ini jelas ga scalable. Solusinya: setiap kali mahasiswa mencoba bikin container baru dan sistem menemukan record lama yang `'running'`, sistem **verifikasi langsung ke Docker Engine** apakah container itu beneran masih hidup. Kalau ternyata sudah tidak ada, record lama otomatis dibersihkan tanpa campur tangan admin. Detail lengkap ada di README bagian "Self-Healing".

### Kenapa EJS (server-rendered), bukan SPA client-side seperti versi awal?

Versi pertama pakai vanilla JS yang nge-swap tampilan halaman di client (`login` → `change-password` → `dashboard` semua dalam satu HTML, disembunyikan/ditampilkan pakai class `hidden`). Ini menyebabkan bug input password ga bisa diketik dengan normal (masalah state management di client yang ga perlu terjadi kalau tiap halaman punya route-nya sendiri). Pindah ke EJS server-rendered per-route menyederhanakan alur dan menghilangkan kelas bug itu sepenuhnya.

---

## Stack Teknologi

| Layer | Teknologi | Alasan Singkat |
|---|---|---|
| Backend | Node.js + Express | Familier, ekosistem luas, cocok untuk I/O-bound (banyak panggilan ke Docker API & DB) |
| Database | PostgreSQL | Robust, native module lebih stabil dibanding SQLite di lingkungan WSL, siap untuk concurrent access |
| Container Engine | Docker + dockerode | Standar industri, dockerode memberi kontrol penuh dari Node.js tanpa shell out ke CLI |
| Frontend | EJS (server-rendered) + Tailwind CSS (CDN) | Sederhana, tanpa build step, cukup untuk kebutuhan dashboard yang tidak terlalu interaktif |
| Auth | express-session + connect-pg-simple + bcrypt | Session disimpan di PostgreSQL (bukan in-memory) supaya tahan restart & tidak leak memory |
| Orkestrasi Deployment | Docker Compose | Satu perintah untuk jalankan app + database sekaligus |

---

## Arsitektur Kode (Layered)

```
Routes → Controllers → Services → Repositories → PostgreSQL
```

- **Routes**: definisi endpoint dan middleware apa yang jalan di situ.
- **Controllers**: terima HTTP request, panggil service yang relevan, format response.
- **Services**: SEMUA logika bisnis ada di sini (validasi, self-healing, rollback transaksi, dsb). Ini layer paling penting untuk dipahami kalau mau nambah fitur.
- **Repositories**: query database murni, tidak ada logika bisnis sama sekali.

Kenapa dipisah begini? Supaya gampang di-test, gampang diganti (misal ganti database tanpa nyentuh logika bisnis), dan gampang buat orang baru paham "kalau mau ubah X, cari di layer mana".

Lihat `WALKTHROUGH.md` untuk tur lengkap fitur-per-fitur yang sudah dibangun.

---

## Roadmap / Ide Pengembangan Selanjutnya

Ini bukan komitmen, cuma catatan ide yang pernah didiskusikan tapi belum dikerjakan:

- [ ] Rate-limit outbound traffic per container (`tc`/`iptables`) untuk jaga-jaga dari penyalahgunaan jaringan (mining, DDoS keluar).
- [ ] Monitoring resource real-time (`docker stats` / cAdvisor / Prometheus) untuk deteksi anomali otomatis.
- [ ] Sistem ujian command Linux berbasis Docker-isolated terminal dengan auto-grading (pernah didiskusikan sebagai proyek terpisah, bisa jadi ekstensi dari platform ini).
- [ ] Integrasi SSO kampus kalau nanti tersedia, menggantikan sistem NIM+password default.
- [ ] Opsi extend TTL container kalau mahasiswa masih aktif memakainya (saat ini strict 24 jam).

---

## Kontributor & Konteks

Proyek ini dikembangkan oleh Rizki Ramadan, mahasiswa Teknologi Informasi UMY yang juga menjabat sebagai asisten dosen untuk mata kuliah PAW (Pengembangan Aplikasi Web) dan PDW (Pemrograman Desain Web), di bawah bimbingan Ir. Asroni, S.T., M.Eng.
