# Kontribusi

Terima kasih sudah tertarik berkontribusi ke proyek ini. Dokumen ini menjelaskan alur kontribusi secara singkat. Untuk konvensi teknis detail (struktur kode, i18n, icon, dsb.), lihat `AGENTS.md` - dokumen tersebut ditulis untuk AI coding agent tapi sama relevannya untuk kontributor manusia.

## Sebelum Mulai

1. Baca `README.md` untuk memahami cara instalasi dan menjalankan proyek secara lokal (Docker Compose).
2. Baca `docs/about-project.md` untuk memahami rasional di balik keputusan teknis yang sudah ada - banyak keputusan desain yang tampak "aneh" sebenarnya sengaja, dengan alasan yang didokumentasikan di sana.
3. Baca `docs/walkthrough.md` untuk peta fitur yang sudah ada dan lokasi kode terkait.

## Alur Kontribusi

1. Fork repository ini (atau buat branch baru kalau kamu punya akses langsung).
2. Buat branch dengan nama deskriptif: `feature/nama-fitur`, `fix/nama-bug`, `docs/apa-yang-diubah`.
3. Lakukan perubahan, ikuti konvensi yang dijelaskan di `AGENTS.md` (terutama soal i18n, icon SVG, dan modal/notifikasi - proyek ini punya konvensi ketat di area tersebut).
4. Jalankan checklist verifikasi (lihat `.github/PULL_REQUEST_TEMPLATE.md`) sebelum membuka PR.
5. Buka Pull Request ke branch `main`, isi template PR dengan lengkap termasuk skenario testing yang sudah dicoba.

## Konvensi Kode

- **Arsitektur berlapis**: Routes → Controllers → Services → Repositories. Jangan taruh logika bisnis di controller, jangan taruh query SQL di service.
- **i18n wajib**: teks baru di UI/API harus ditambahkan ke `src/i18n/en.json` DAN `src/i18n/id.json` secara bersamaan.
- **Tidak ada emoji di UI**: pakai SVG icon lewat `views/partials/icon.ejs`.
- **Modal/notifikasi**: pakai wrapper `public/js/notify.js` (SweetAlert2), bukan `alert()`/`confirm()` browser.
- **Environment variable**: konfigurasi baru untuk Docker Compose harus lewat env var dengan default yang aman, tidak boleh hardcoded.

Detail lengkap ada di `AGENTS.md`.

## Melaporkan Bug atau Mengusulkan Fitur

Gunakan template issue yang tersedia:
- [Bug Report](.github/ISSUE_TEMPLATE/bug_report.md)
- [Feature Request](.github/ISSUE_TEMPLATE/feature_request.md)

## Kode Etik

Bersikap hormat dan konstruktif. Proyek ini dikembangkan dalam konteks akademik (praktikum kampus) - diskusi teknis yang tajam dipersilakan, tapi tetap jaga sikap profesional terhadap sesama kontributor.

## Pertanyaan

Kalau ada yang kurang jelas soal konvensi atau arsitektur proyek, buka issue dengan label `question`, atau hubungi maintainer (lihat `docs/about-project.md` bagian Kontributor).
