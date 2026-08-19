---
name: Bug Report
about: Laporkan bug atau perilaku yang tidak sesuai ekspektasi
title: "[BUG] "
labels: bug
assignees: ''
---

## Deskripsi Bug

Jelaskan dengan singkat dan jelas bug apa yang terjadi.

## Langkah Reproduksi

1. Buka '...'
2. Klik '...'
3. Isi form dengan '...'
4. Lihat error

## Perilaku yang Diharapkan

Jelaskan apa yang seharusnya terjadi.

## Perilaku Aktual

Jelaskan apa yang benar-benar terjadi. Sertakan screenshot kalau membantu.

## Request ID (kalau ada)

Kalau ada pesan error dari aplikasi, cek response header `X-Request-Id` lewat DevTools browser (tab Network), lalu sertakan di sini. Ini membantu penelusuran cepat lewat `grep "<request-id>" logs/combined-*.log`.

```
Request ID: 
```

## Lingkungan

- Diakses lewat: [mis. Chrome di WSL / Firefox di laptop kampus]
- Deployment: [Docker Compose / manual]
- Versi/commit (kalau tahu): 

## Log Server Terkait (opsional)

Kalau kamu admin dan bisa akses `/admin/logs`, tempel potongan log yang relevan di sini (gunakan filter level `error` dan cari berdasarkan request ID/NIM di atas).

```
(tempel log di sini)
```
