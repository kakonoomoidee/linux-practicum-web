# AGENTS.md

Panduan ini ditujukan untuk AI coding agent (Claude Code, Cursor, GitHub Copilot Workspace, dsb.) yang bekerja di repository ini. Untuk konteks proyek secara umum, lihat `README.md` (instalasi), `docs/about-project.md` (latar belakang & rasional keputusan teknis), dan `docs/walkthrough.md` (tur fitur).

## Ringkasan Proyek

Platform provisioning container Linux on-demand untuk praktikum mahasiswa. Stack: Node.js/Express (layered architecture), PostgreSQL, EJS + Tailwind CSS (CDN, tanpa build step), Docker + Docker Compose, Winston (logging), SweetAlert2 (modal/notifikasi), i18n custom (EN/ID).

## Perintah Penting

```bash
# Development lokal (tanpa Docker, butuh PostgreSQL berjalan manual)
npm install
npm run dev              # nodemon-style watch mode

# Build & jalankan penuh via Docker Compose (cara utama menjalankan proyek ini)
docker compose up -d --build
docker compose logs -f app
docker compose exec app node scripts/seed.js
docker compose exec app node scripts/import-students.js <file.csv>

# Cek syntax semua file JS tanpa menjalankan test suite formal (belum ada test otomatis)
find . -name "*.js" -not -path "./node_modules/*" -exec node --check {} \;

# Render-check semua EJS - PENTING: gunakan ejs.renderFile(), bukan ejs.compile() saja.
# compile() TIDAK mengeksekusi include() bersarang, jadi bug di dalam partial (mis.
# views/partials/*.ejs) tidak akan terdeteksi kalau cuma di-compile, harus di-render.
node -e "require('ejs').renderFile('views/login.ejs', {}, {}, (err) => console.log(err || 'OK'))"

# Validasi konfigurasi Docker Compose tanpa benar-benar menjalankan
docker compose config --quiet
```

Belum ada test suite otomatis (unit/integration test) di proyek ini. Verifikasi perubahan dilakukan lewat kombinasi syntax check, render check EJS di atas, dan smoke test manual end-to-end (jalankan server, curl endpoint terkait). Kalau menambahkan fitur baru yang signifikan, pertimbangkan menuliskan smoke test manual di deskripsi PR.

## Arsitektur (Wajib Dipahami Sebelum Mengubah Logika Bisnis)

```
Routes → Controllers → Services → Repositories → PostgreSQL
```

- **Jangan** taruh logika bisnis di controller atau route. Controller cuma boleh: parsing request, memanggil service, memformat response HTTP.
- **Jangan** taruh query SQL di service. Repository yang pegang seluruh akses database.
- Error antar-layer pakai `src/utils/ServiceError.js` dengan `code` simbolik (bukan HTTP status). Controller yang menerjemahkan `code` jadi HTTP status (lihat `errorStatusMap` di tiap controller) dan pesan terlokalisasi lewat `res.locals.t('errors.' + err.code)`.

## Konvensi i18n (Wajib Diikuti untuk Teks Baru)

Semua teks yang tampil ke pengguna (di view maupun response API) HARUS lewat sistem i18n, tidak boleh hardcoded string Indonesia atau Inggris langsung di kode.

- Dictionary ada di `src/i18n/en.json` (default/fallback) dan `src/i18n/id.json`. **Selalu update kedua file ini bersamaan** - jangan tambah key cuma di salah satu.
- Di EJS: pakai `<%= t('namespace.key') %>` atau `<%= t('namespace.key', { var: value }) %>` untuk interpolasi `{var}`.
- Di controller: pakai `res.locals.t('errors.KODE_ERROR')` untuk pesan error, atau `res.locals.t('namespace.key')` untuk pesan sukses.
- Kalau nambah `ServiceError` baru di service layer, tambahkan `code`-nya sebagai key baru di `errors.*` pada **kedua** file dictionary, dan daftarkan status HTTP-nya di `errorStatusMap` controller terkait.
- Untuk pesan dengan variabel (mis. jumlah, NIM), pakai placeholder `{namaVar}` di dictionary dan lewat `vars` kedua di pemanggilan `t()`.

## Konvensi Icon (Wajib Diikuti, Jangan Pakai Emoji)

Proyek ini **tidak memakai emoji** di UI - semua ikon adalah SVG lewat partial `views/partials/icon.ejs`.

- Pemakaian: `<%- include('partials/icon', { name: 'box', cls: 'w-5 h-5' }) %>`
- **PENTING**: parameter ukuran/class pakai nama `cls`, BUKAN `class` - karena `class` adalah reserved word JavaScript dan akan menyebabkan error kalau dipakai sebagai nama variable EJS local (EJS meng-compile locals lewat mekanisme yang setara `with()`).
- Daftar icon yang tersedia ada di dalam `views/partials/icon.ejs` sendiri (dictionary `icons`). Kalau butuh icon baru, tambahkan entry baru di situ dengan gaya outline konsisten (stroke-width 2, mengikuti konvensi Feather/Lucide) - jangan bikin file SVG terpisah per icon.

## Konvensi Modal & Notifikasi

Pakai **SweetAlert2** (sudah di-load via CDN di `views/partials/head.ejs`) lewat wrapper `public/js/notify.js`, bukan `alert()`/`confirm()` browser native.

- `notify.success(message)` / `notify.error(message)` - toast notification pojok kanan atas
- `await confirmAction({ title, text, confirmText, cancelText, danger })` - modal konfirmasi, return `Promise<boolean>`
- `await promptInput({ title, text, inputLabel, placeholder, confirmText, validator })` - modal dengan input teks

## Keamanan (Perhatikan Sebelum Mengubah Kode Terkait Provisioning Docker)

- Container mahasiswa berjalan dengan `CapDrop: ALL` + capability minimal (lihat `src/services/dockerService.js`). **Jangan** menambah capability baru tanpa alasan teknis kuat yang didokumentasikan lewat komentar kode (contoh kasus: `SYS_CHROOT` ditambahkan karena OpenSSH privilege separation butuh itu, didokumentasikan langsung di kode).
- Jangan pernah menyimpan password/API key dalam bentuk plaintext - gunakan `bcrypt` (untuk password akun) yang sudah dipakai konsisten di seluruh proyek. Untuk API key, gunakan hash satu-arah (lihat implementasi `apiKeyService.js` kalau sudah ada) dan tampilkan nilai plaintext hanya sekali saat pembuatan.
- Endpoint yang menerima input dari luar sistem (API gateway, form publik) wajib melalui rate limiting (`express-rate-limit`), mengikuti pola yang sudah ada di `src/routes/authRoutes.js` dan `src/routes/adminRoutes.js`.

## Struktur Commit & PR

- Setiap fitur/perbaikan signifikan dikerjakan di branch terpisah (`feature/...`, `docs/...`, `fix/...`), tidak langsung ke `main`.
- Pesan commit menjelaskan **apa** yang berubah dan **kenapa** (khususnya untuk bug fix - jelaskan root cause, bukan cuma gejalanya).
- Sebelum push, jalankan checklist di bagian "Perintah Penting" di atas (syntax check + render check + `docker compose config`).

## Yang Perlu Diperhatikan Kalau Mengubah `docker-compose.yml`

- Service `app` pakai `network_mode: host` (bukan bridge network default) - ini disengaja untuk auto-detect IP LAN (lihat `docs/about-project.md`). Ini juga berarti `app` **tidak bisa** resolve nama service Docker Compose lain (mis. `db`) lewat DNS - koneksi ke database pakai `127.0.0.1:<DB_HOST_PORT>`, bukan `db:5432`.
- Semua nilai konfigurasi harus lewat environment variable dengan default yang aman (`${VAR:-default}`), **tidak boleh ada nilai hardcoded**. Ini termasuk port, path, nama image.
