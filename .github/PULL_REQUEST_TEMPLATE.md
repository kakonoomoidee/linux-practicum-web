## Ringkasan

Jelaskan secara singkat apa yang diubah dan kenapa.

## Jenis Perubahan

- [ ] Bug fix
- [ ] Fitur baru
- [ ] Perubahan dokumentasi
- [ ] Perubahan infrastruktur/konfigurasi (Docker, CI, dsb.)
- [ ] Breaking change (mengubah perilaku yang sudah ada dengan cara yang tidak backward-compatible)

## Checklist Sebelum Merge

- [ ] Sudah menjalankan syntax check untuk seluruh file JS yang diubah (`node --check`)
- [ ] Sudah menjalankan render check untuk EJS yang diubah (pakai `ejs.renderFile()`, bukan cuma `compile()` - lihat `AGENTS.md`)
- [ ] Kalau menambah teks baru ke UI/API: sudah ditambahkan ke **kedua** `src/i18n/en.json` dan `src/i18n/id.json`
- [ ] Kalau mengubah `docker-compose.yml`: sudah dijalankan `docker compose config --quiet` untuk validasi
- [ ] Sudah diuji end-to-end secara manual (jelaskan skenario testing di bawah)
- [ ] Dokumentasi terkait (README/docs/AGENTS.md) sudah diperbarui kalau relevan

## Skenario Testing

Jelaskan langkah-langkah yang sudah dicoba untuk memverifikasi perubahan ini bekerja dengan benar.

## Catatan Tambahan

Hal lain yang perlu diketahui reviewer (breaking change, dependency baru, migrasi database, dsb.).
