const crypto = require('crypto');

/**
 * Proteksi CSRF pakai pola "synchronizer token" - token acak disimpan di session
 * (server-side, ga bisa dibaca/ditebak dari luar), dan HARUS disertakan di setiap
 * request yang mengubah state (POST/PUT/PATCH/DELETE) lewat header "X-CSRF-Token"
 * atau field form tersembunyi "_csrf".
 *
 * Kenapa bukan paket "csurf"? Paket itu sudah deprecated dan tidak lagi menerima
 * update keamanan. Pola ini sederhana, cukup buat aplikasi session-based seperti
 * proyek ini, dan tidak menambah dependency yang berisiko.
 *
 * Ini KOMPLEMENTER dengan cookie session yang sudah "sameSite: strict" (lihat
 * src/app.js) - dua lapis pertahanan: cookie ga akan terkirim sama sekali dari
 * request cross-site (lapis 1), dan seandainya ada skenario di mana sameSite
 * "strict" gagal (misal browser lama yang belum dukung), token CSRF eksplisit
 * ini jadi lapis kedua yang independen dari perilaku cookie.
 */

function ensureCsrfToken(req) {
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(32).toString('hex');
  }
  return req.session.csrfToken;
}

/**
 * Middleware yang dipasang GLOBAL - selalu generate/pastikan token ada di session,
 * dan expose ke res.locals.csrfToken supaya bisa dipakai di EJS (hidden input form)
 * maupun dikirim ke client lewat halaman buat dipakai di header fetch().
 */
function attachCsrfToken(req, res, next) {
  if (req.session) {
    res.locals.csrfToken = ensureCsrfToken(req);
  }
  next();
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Middleware validasi - pasang di route yang state-changing. Cek token dari
 * header X-CSRF-Token (dipakai fetch/AJAX) atau body._csrf (dipakai form HTML biasa).
 */
function verifyCsrfToken(req, res, next) {
  if (SAFE_METHODS.has(req.method)) {
    return next();
  }

  // API Gateway (/api/v1/*) pakai autentikasi API key lewat header X-API-Key,
  // BUKAN cookie session - jadi secara desain ga rentan CSRF (browser ga otomatis
  // ngirim header custom kayak gitu dari situs lain, beda sama cookie yang
  // otomatis ke-attach). Skip proteksi CSRF khusus buat path ini.
  if (req.path.startsWith('/api/v1/') || req.baseUrl === '/api/v1') {
    return next();
  }

  const sessionToken = req.session && req.session.csrfToken;
  const providedToken = req.header('X-CSRF-Token') || (req.body && req.body._csrf);

  if (!sessionToken || !providedToken || sessionToken !== providedToken) {
    const t = res.locals.t || ((key) => key);
    const message = t('errors.CSRF_TOKEN_INVALID');

    // Deteksi JSON vs form HTML berdasarkan Content-Type request, BUKAN path prefix -
    // endpoint AJAX kita ada di banyak tempat (/api/*, tapi juga /admin/instances/*,
    // /admin/students/*, /admin/settings/*, /admin/api-keys/*), sedangkan cuma SATU
    // endpoint yang benar-benar form HTML biasa (POST /admin/login). Semua request
    // yang dikirim lewat fetch() di app ini SELALU set 'Content-Type: application/json'
    // (lihat public/js/*.js), jadi ini penanda yang lebih akurat.
    if (req.is('application/json')) {
      return res.status(403).json({ success: false, code: 403, message, data: null });
    }

    // Request dari form HTML biasa (mis. submit login admin) - render halaman
    // error yang jelas, bukan JSON mentah yang ga berguna buat pengguna biasa.
    return res.status(403).render('errors/403', { t, lang: res.locals.lang || 'en', message });
  }

  next();
}

module.exports = { attachCsrfToken, verifyCsrfToken };
