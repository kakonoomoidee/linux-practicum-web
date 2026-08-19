# 📖 Tentang Proyek: Praktikum Linux — Container On-Demand

Dokumen ini berfungsi sebagai **source of truth** untuk proyek ini — mencakup latar belakang, keputusan teknis yang diambil beserta rasionalnya, serta batasan yang ditetapkan secara sengaja. Pertanyaan seputar "mengapa keputusan X diambil, bukan alternatif Y" seharusnya terjawab melalui dokumen ini.

---

## Latar Belakang

Mahasiswa pada mata kuliah praktikum Linux (jaringan/TI) kerap menghadapi kendala dalam menyiapkan lingkungan Linux secara mandiri:
- Perangkat dengan spesifikasi terbatas sering tidak mampu atau tidak dapat menjalankan WSL2 maupun virtual machine lokal (VirtualBox, dsb.) — memerlukan fitur virtualisasi pada BIOS yang terkadang tidak aktif atau tidak didukung.
- Instalasi WSL2 beserta distribusi Linux memerlukan kapasitas penyimpanan dan bandwidth yang signifikan, menjadi kendala bagi mahasiswa dengan koneksi internet terbatas.
- Perbedaan lingkungan antar perangkat mahasiswa menimbulkan masalah inkonsistensi ("berfungsi pada perangkat saya, namun tidak pada perangkat lain") yang menyita waktu praktikum.

**Pendekatan penyelesaian:** mahasiswa cukup mengakses browser dari jaringan kampus, melakukan provisioning container melalui satu klik, dan memperoleh akses SSH ke lingkungan Linux yang seragam bagi seluruh peserta — tanpa instalasi perangkat lunak tambahan pada perangkat masing-masing, selain terminal bawaan sistem operasi.

---

## Tujuan Proyek

1. Menyediakan akses container Linux penuh (termasuk akses `sudo`) melalui browser, tanpa instalasi lokal.
2. Memastikan lingkungan kerja yang seragam bagi seluruh mahasiswa, mengurangi masalah inkonsistensi lingkungan.
3. Mendukung model self-service — mahasiswa tidak perlu menunggu provisioning manual dari asisten dosen.
4. Menjamin keamanan operasional pada server kampus tanpa membahayakan sistem lain pada jaringan yang sama.

## Batasan yang Ditetapkan Secara Sengaja

- **Bukan** pengganti VPS atau layanan cloud publik — dirancang khusus untuk diakses dari jaringan kampus, bukan dari internet umum.
- **Bukan** platform multi-tenant berskala besar — target pengguna adalah mahasiswa pada satu jurusan/kelas, bukan ribuan pengguna simultan.
- **Bukan** sandbox yang sepenuhnya tahan terhadap penyalahgunaan yang disengaja — mahasiswa memperoleh akses `sudo` penuh di dalam container mereka, sehingga proyek ini mengandalkan **isolasi pada level infrastruktur** (jaringan, resource limit), bukan pembatasan perintah di dalam container.

---

## Keputusan Teknis dan Rasional

### Pembatasan Akses ke Jaringan Kampus (Bukan VPN/Internet Publik)

Kampus (UMY) belum menyediakan layanan VPN bagi mahasiswa. Alih-alih mengekspos port SSH ke internet publik — yang membawa risiko keamanan signifikan mengingat aktivitas scanning port SSH oleh bot bersifat masif dan berkelanjutan — platform ini dirancang untuk **hanya dapat diakses dari LAN/WiFi kampus**. Konsekuensinya, mahasiswa perlu berada di lingkungan kampus untuk mengakses platform; hal ini merupakan keputusan yang diambil secara sadar demi keamanan, bukan keterbatasan teknis yang belum tertangani.

### TTL Container 24 Jam (Penghapusan Otomatis)

Kebijakan ini mencegah resource server terkuras oleh container yang tidak dihapus mahasiswa, sekaligus mendorong mahasiswa untuk menyimpan hasil kerja pada media persisten (git, dsb.) alih-alih mengandalkan penyimpanan pada container yang bersifat sementara.

### Batasan 1 Container per Mahasiswa

Pendekatan ini menyederhanakan pengelolaan sistem dan mencegah satu mahasiswa memonopoli resource server melalui pembuatan container secara berlebihan. Nilai batasan dapat disesuaikan melalui variabel `MAX_CONTAINER_PER_STUDENT` pada `.env` apabila kebutuhan berubah.

### Akses `sudo` Penuh bagi Mahasiswa

Tujuan pembelajaran praktikum mencakup administrasi sistem Linux — instalasi package, konfigurasi service, dsb. Pembatasan akses `sudo` akan menghilangkan esensi pembelajaran tersebut. Sebagai gantinya, **isolasi diterapkan pada level infrastruktur**:
- `CapDrop: ALL` dengan capability minimal (bukan mode `--privileged`)
- `PidsLimit: 256` (mitigasi terhadap fork bomb yang dapat menghabiskan resource host)
- Resource limit (memory, CPU, disk quota) per container
- Isolasi jaringan antar-container (`enable_icc=false`) — mencegah satu mahasiswa mengakses container mahasiswa lain
- Flag keamanan `no-new-privileges` diaktifkan

### Autentikasi Berbasis NIM + Password Default (Bukan SSO Kampus)

Integrasi dengan sistem SSO kampus (SIM/portal UMY) memerlukan koordinasi dengan pihak IT kampus yang berada di luar kendali proyek pada tahap awal pengembangan. Sebagai solusi sementara: daftar NIM dan nama diimpor dari hasil ekspor CSV elearning (Moodle), dengan password default `12345678` yang **wajib diganti** pada login pertama sebelum akses fitur lain diizinkan. Pola ini umum dijumpai pada berbagai sistem kampus, menyerupai mekanisme aktivasi akun baru.

### Arsitektur Docker "Sibling Containers" (Bukan Docker-in-Docker)

Container `app` memasang Docker socket milik host (`/var/run/docker.sock`), bukan menjalankan Docker daemon terpisah di dalam dirinya (true Docker-in-Docker). Rasional:
- Docker-in-Docker sesungguhnya bersifat kompleks, rentan terhadap masalah storage driver, dan memerlukan mode privileged yang justru meningkatkan risiko keamanan.
- Pola "sibling" (aplikasi mendelegasikan perintah ke Docker Engine host) lebih stabil dan merupakan pola umum pada aplikasi yang memerlukan orkestrasi container lain (serupa dengan mekanisme kerja Portainer, dsb.).
- Konsekuensinya, container mahasiswa yang dibuat berkedudukan sebagai *sibling* dari container `app`, dengan port yang di-bind langsung ke host — sehingga `SSH_HOST_DISPLAY` harus merujuk pada IP LAN server, bukan nama service Docker Compose.

### Migrasi ke PostgreSQL (dari SQLite pada Versi Awal)

Implementasi awal menggunakan `better-sqlite3`, namun native module ini menunjukkan ketidakstabilan pada lingkungan WSL apabila proyek ditempatkan pada drive Windows (`/mnt/e/...`, bukan filesystem native WSL) — kerap mengalami crash saat loading akibat masalah ABI/filesystem. PostgreSQL menawarkan stabilitas yang lebih baik untuk kebutuhan ini, lebih sesuai untuk dijalankan sebagai service terpisah pada Docker Compose, dan lebih siap untuk skenario penggunaan pada beberapa kelas/mata kuliah secara simultan di masa mendatang.

### Mekanisme Self-Healing pada Container

Pada implementasi awal, apabila sebuah container dihapus secara manual atau mengalami crash pada level Docker sementara record pada basis data masih berstatus `'running'`, mahasiswa terkait akan **terus-menerus ditolak** saat mencoba membuat container baru (karena sistem menganggap mereka masih memiliki container aktif) — satu-satunya solusi pada saat itu adalah intervensi manual administrator pada basis data. Pendekatan ini jelas tidak scalable. Solusi yang diterapkan: setiap kali mahasiswa mencoba membuat container baru dan sistem menemukan record lama berstatus `'running'`, sistem melakukan **verifikasi langsung ke Docker Engine** untuk memastikan status aktualnya. Apabila ternyata sudah tidak ada, record lama dibersihkan secara otomatis tanpa keterlibatan administrator. Detail teknis lengkap tersedia pada README bagian "Self-Healing".

### Auto-Detect untuk SSH_HOST_DISPLAY (Bukan Konfigurasi Manual)

Implementasi awal mewajibkan administrator mengisi `SSH_HOST_DISPLAY` secara manual pada `.env`, dengan nilai placeholder contoh `10.0.10.5` pada `.env.example`. Permasalahannya: apabila administrator lupa mengganti placeholder tersebut (atau nilainya tidak sesuai), dashboard tetap menampilkan perintah SSH yang tampak valid namun sebenarnya merujuk pada IP yang tidak eksis — menimbulkan kebingungan pada mahasiswa maupun pengembang yang sedang melakukan pengujian, karena kegagalan koneksi SSH terjadi meskipun seluruh komponen lain tampak berfungsi normal.

Mekanisme auto-detect (`src/utils/detectHost.js`) diterapkan dengan urutan prioritas sebagai berikut:
- Deteksi lingkungan **WSL** (variabel environment `WSL_DISTRO_NAME` tersedia) → menggunakan `localhost` secara otomatis, memanfaatkan fitur bawaan WSL2 yang meneruskan port ke Windows tanpa memerlukan pengetahuan mengenai IP internal WSL yang dapat berubah setiap restart.
- Pada **server Linux** murni → memindai antarmuka jaringan, memilih alamat IPv4 non-internal yang paling sesuai (melewati loopback dan antarmuka virtual Docker).
- Override manual pada `.env` **senantiasa diprioritaskan** apabila diisi — relevan untuk server dengan banyak antarmuka jaringan di mana auto-detect berpotensi memilih antarmuka yang tidak tepat.

Agar aplikasi dapat mengenali antarmuka jaringan asli milik host (bukan network internal Docker Compose), service `app` pada `docker-compose.yml` menggunakan `network_mode: host`. Konsekuensinya, aplikasi terhubung ke basis data melalui `127.0.0.1` (bukan nama service `db`), karena resolusi DNS antar-service Docker Compose hanya berfungsi pada network bridge default. Trade-off ini dinilai sepadan, mengingat masalah "kegagalan SSH akibat host yang tidak sesuai" jauh lebih sering terjadi dan lebih membingungkan dibandingkan kompleksitas tambahan pada konfigurasi `docker-compose.yml`.

**Catatan kompatibilitas:** `network_mode: host` memerlukan Docker Engine native pada Linux/WSL2, dan kurang konsisten pada Docker Desktop (Windows/Mac) akibat perbedaan virtualisasi jaringan. Untuk kasus tersebut, konfigurasi manual `SSH_HOST_DISPLAY` pada `.env` tetap tersedia sebagai solusi.

### EJS Server-Rendered (Bukan SPA Client-Side seperti Versi Awal)

Implementasi awal menggunakan vanilla JavaScript yang melakukan penggantian tampilan pada sisi client (`login` → `change-password` → `dashboard` seluruhnya berada pada satu berkas HTML, disembunyikan/ditampilkan menggunakan class `hidden`). Pendekatan ini menyebabkan bug pada input password yang tidak dapat diketik secara normal — permasalahan terkait state management pada client yang seharusnya tidak terjadi apabila setiap halaman memiliki route tersendiri. Migrasi ke EJS server-rendered per-route menyederhanakan alur aplikasi dan menghilangkan kelas bug tersebut secara menyeluruh.

### Structured Logging dengan Winston (Bukan `console.log`)

Pada tahap pengembangan awal, `console.log`/`console.error` memadai untuk kebutuhan debugging cepat. Namun, seiring platform mulai digunakan oleh mahasiswa secara aktual, pendekatan tersebut tidak lagi memadai untuk kebutuhan monitoring produksi:
- Tidak terdapat pemisahan level (informasi, peringatan, dan error tercampur tanpa mekanisme filtering).
- Tidak tersedia cara yang efisien untuk menelusuri kejadian pada request atau pengguna tertentu tanpa pemindaian manual.
- Log hilang setiap kali proses di-restart (tidak ada persistensi), padahal riwayat log justru paling dibutuhkan pada saat terjadi masalah.

Solusi yang diterapkan adalah **Winston** (library logging yang umum digunakan pada ekosistem Node.js), dengan karakteristik:
- Level log standar (`error`/`warn`/`info`/`http`/`debug`) — memungkinkan pengaturan level minimum yang ditampilkan/disimpan sesuai kebutuhan (misalnya hanya `warn` ke atas pada lingkungan produksi untuk mengurangi noise).
- Format JSON terstruktur pada file dan console produksi — setiap baris log merupakan objek JSON valid dengan field yang konsisten (`nim`, `event`, `containerName`, dsb.), siap untuk keperluan filtering, atau integrasi dengan tooling monitoring (ELK, Grafana Loki, dsb.) tanpa memerlukan perubahan pada kode aplikasi.
- Rotasi file log otomatis (harian, retensi 14 hari) — log tetap tersedia meskipun aplikasi di-restart, namun tidak menumpuk tanpa batas.
- `requestId` unik per HTTP request — memungkinkan penelusuran laporan error secara presisi melalui pencarian request ID pada log, mencakup seluruh jejak eksekusi (request masuk → pemrosesan pada service layer → response keluar) tanpa perlu menebak baris log yang relevan.

### Konfigurasi Terpusat Melalui Environment Variable

Seluruh parameter konfigurasi pada `docker-compose.yml` — termasuk port PostgreSQL sisi host, image PostgreSQL yang digunakan, path Docker socket, dan direktori log — bersumber dari environment variable dengan nilai default yang aman, tanpa nilai hardcoded. Pendekatan ini penting khususnya untuk port PostgreSQL: nilai default sengaja ditetapkan `5433` (bukan `5432`, port standar PostgreSQL) karena banyak pengembang telah menjalankan instance PostgreSQL secara lokal pada port default tersebut. Tanpa konfigurasi yang fleksibel, kondisi ini akan menyebabkan kegagalan `docker compose up` akibat konflik port.

### Log Viewer pada Admin Panel

Menyediakan visibilitas terhadap aktivitas sistem bagi administrator tanpa memerlukan akses terminal ke server — relevan mengingat administrator platform ini tidak selalu memiliki akses SSH langsung ke server produksi, atau lebih memilih antarmuka berbasis browser untuk kebutuhan pemantauan rutin. Implementasi membaca langsung dari file log yang sama dengan yang digunakan oleh Winston, sehingga tidak memerlukan infrastruktur logging tambahan (mis. log aggregator terpisah) untuk kasus penggunaan skala proyek ini.

### Halaman Settings Terpisah dari Change Password Wajib

Sebelumnya, satu-satunya cara mengganti password adalah lewat halaman `/change-password` yang hanya bisa diakses saat `first_login = true` (login pertama). Ini artinya mahasiswa/admin yang sekadar ingin ganti password secara voluntary (bukan karena dipaksa sistem) tidak punya jalur resmi untuk melakukannya. Halaman `/settings` (mahasiswa) dan `/admin/settings` (admin) menyediakan jalur itu, sekaligus jadi tempat menyimpan preferensi bahasa ke akun (bukan cuma cookie per-browser) — supaya preferensi ini konsisten kalau nanti ada fitur lain yang butuh tahu bahasa pilihan user tanpa bergantung pada cookie yang bisa hilang atau berbeda per perangkat.

Admin sebelumnya juga sama sekali tidak punya cara mengganti password akunnya sendiri selain lewat script `seed.js` atau mengubah manual di database — ini celah operasional yang cukup mendasar, ditutup lewat halaman Settings admin.

### API Gateway dengan Autentikasi API Key Terpisah

Platform ini pada dasarnya adalah sistem tertutup (session-based, cuma bisa diakses lewat browser dari jaringan kampus). Tapi ada kebutuhan realistis untuk integrasi programatik dari sistem lain di masa depan — misalnya sinkronisasi data mahasiswa dari/ke sistem akademik, atau dashboard eksternal yang menampilkan status pemakaian container. Untuk kebutuhan ini, autentikasi berbasis session (cookie) tidak cocok — sistem lain butuh cara stabil untuk "membuktikan identitasnya" tanpa proses login interaktif.

Solusinya: API key terpisah total dari sistem login web, dengan karakteristik:
- **Read-only** - API Gateway (`/api/v1/*`) sengaja dibatasi ke endpoint baca saja (daftar mahasiswa, daftar container aktif). Kemampuan menulis/mengubah data lewat API key tidak disediakan pada tahap ini, untuk membatasi blast radius kalau ada key yang bocor.
- **Hash, bukan plaintext** - API key mengikuti pola yang sama seperti password: nilai asli cuma ditampilkan sekali saat dibuat, yang tersimpan di database cuma hash-nya (`bcrypt`, sama seperti password akun).
- **Revocable** - admin bisa mencabut key kapan saja lewat halaman Settings tanpa perlu restart aplikasi atau mengubah kode.
- **Rate-limited per key** (bukan per IP) - mencegah satu integrasi yang salah konfigurasi (mis. polling terlalu sering) membebani server, sekaligus memudahkan diagnosis kalau ada satu integrasi tertentu yang bermasalah.
- **Bahasa selalu Inggris** - berbeda dari web UI yang mendukung dua bahasa, response API Gateway konsisten berbahasa Inggris karena dikonsumsi sistem/program, bukan manusia yang butuh preferensi bahasa.

---

## Stack Teknologi

| Layer | Teknologi | Rasional |
|---|---|---|
| Backend | Node.js + Express | Ekosistem matang, sesuai untuk beban kerja I/O-bound (komunikasi intensif dengan Docker API dan basis data) |
| Basis Data | PostgreSQL | Stabilitas tinggi, native module lebih reliable dibandingkan SQLite pada lingkungan WSL, mendukung concurrent access |
| Container Engine | Docker + dockerode | Standar industri; dockerode menyediakan kontrol penuh dari Node.js tanpa memerlukan shell out ke CLI |
| Frontend | EJS (server-rendered) + Tailwind CSS (CDN) | Pendekatan sederhana tanpa build step, memadai untuk kebutuhan dashboard yang tidak memerlukan interaktivitas tinggi |
| Autentikasi | express-session + connect-pg-simple + bcrypt | Sesi disimpan pada PostgreSQL (bukan in-memory), tahan terhadap restart dan tidak menyebabkan memory leak |
| Logging | Winston | Level log standar, format JSON terstruktur, rotasi file otomatis — siap untuk kebutuhan monitoring produksi |
| Orkestrasi Deployment | Docker Compose | Deployment aplikasi dan basis data melalui satu perintah |

---

## Arsitektur Kode (Layered)

```
Routes → Controllers → Services → Repositories → PostgreSQL
```

- **Routes**: definisi endpoint dan middleware yang diterapkan.
- **Controllers**: menerima HTTP request, memanggil service yang relevan, memformat response.
- **Services**: seluruh logika bisnis berada pada layer ini (validasi, self-healing, rollback transaksi, dsb.) — layer yang paling penting untuk dipahami saat menambahkan fitur baru.
- **Repositories**: akses basis data murni, tanpa logika bisnis.

Pemisahan ini diterapkan untuk memudahkan pengujian, memudahkan penggantian komponen (misalnya migrasi basis data tanpa menyentuh logika bisnis), dan memudahkan pengembang baru memahami lokasi kode yang relevan untuk perubahan tertentu.

Lihat `docs/walkthrough.md` untuk tinjauan lengkap fitur yang telah diimplementasikan.

---

## Roadmap

Daftar berikut merupakan gagasan pengembangan yang pernah didiskusikan namun belum diimplementasikan, bukan merupakan komitmen pengembangan:

- [ ] Rate-limiting outbound traffic per container (`tc`/`iptables`) sebagai mitigasi tambahan terhadap penyalahgunaan jaringan (cryptomining, DDoS keluar).
- [ ] Monitoring resource real-time (`docker stats` / cAdvisor / Prometheus) untuk deteksi anomali otomatis.
- [ ] Sistem ujian berbasis command Linux dengan terminal ter-isolasi Docker dan auto-grading (pernah didiskusikan sebagai proyek terpisah, berpotensi menjadi ekstensi dari platform ini).
- [ ] Integrasi SSO kampus apabila tersedia di masa mendatang, menggantikan sistem NIM dan password default.
- [ ] Opsi perpanjangan TTL container bagi mahasiswa yang masih aktif menggunakannya (saat ini bersifat strict 24 jam).
- [ ] Integrasi log viewer dengan tooling monitoring eksternal (ELK, Grafana Loki) apabila skala penggunaan platform meningkat.

---

## Kontributor dan Konteks

Proyek ini dikembangkan oleh Rizki Ramadan, mahasiswa Program Studi Teknologi Informasi Universitas Muhammadiyah Yogyakarta (UMY), yang juga menjabat sebagai asisten dosen untuk mata kuliah PAW (Pengembangan Aplikasi Web) dan PDW (Pemrograman Desain Web), di bawah bimbingan Ir. Asroni, S.T., M.Eng.
