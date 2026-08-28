// Dibaca dari meta tag yang di-render server-side (lihat views/partials/head.ejs).
// Dipakai di semua file JS lain yang manggil fetch() buat request state-changing
// (POST/PUT/PATCH/DELETE) - ditambahkan sebagai header "X-CSRF-Token".
function getCsrfToken() {
  const meta = document.querySelector('meta[name="csrf-token"]');
  return meta ? meta.content : '';
}
