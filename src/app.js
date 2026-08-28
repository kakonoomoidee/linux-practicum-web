require('dotenv').config();
const express = require('express');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const cookieParser = require('cookie-parser');
const path = require('path');

const config = require('./config/env');
const logger = require('./config/logger');
const requestLogger = require('./middleware/requestLogger');
const i18nMiddleware = require('./middleware/i18n');
const { attachCsrfToken, verifyCsrfToken } = require('./middleware/csrf');
const { pool } = require('./db/connection');

const viewRoutes = require('./routes/viewRoutes');
const authRoutes = require('./routes/authRoutes');
const containerRoutes = require('./routes/containerRoutes');
const adminRoutes = require('./routes/adminRoutes');
const apiV1Routes = require('./routes/apiV1Routes');

/**
 * Builder function, bukan instance langsung - supaya test suite bisa bikin
 * instance app baru per test file kalau perlu, tanpa saling ganggu state.
 * Fungsi ini TIDAK memanggil app.listen() - itu tanggung jawab server.js.
 */
function createApp() {
  const app = express();

  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, '..', 'views'));

  // Kalau app di belakang reverse proxy (nginx dll), ini bikin req.ip ambil IP asli
  // mahasiswa dari header X-Forwarded-For, bukan IP proxy-nya.
  //
  // PENTING: "true" itu percaya SEMUA proxy di depan app (gampang di-spoof kalau app
  // somehow ke-expose langsung tanpa proxy beneran). Pakai TRUST_PROXY_HOPS di .env
  // buat nentuin persis berapa "hop" reverse proxy yang beneran ada di depan app
  // (default 0 = ga ada proxy, req.ip diambil langsung dari koneksi TCP - paling aman
  // buat setup default di server kampus tanpa nginx di depannya).
  const trustProxyHops = parseInt(process.env.TRUST_PROXY_HOPS || '0', 10);
  if (trustProxyHops > 0) {
    app.set('trust proxy', trustProxyHops);
  }

  app.use(requestLogger);

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Session disimpan di PostgreSQL (tabel "session", auto-dibuat) - bukan MemoryStore,
  // jadi aman dipakai multi-process dan ga leak memory / ilang pas restart.
  app.use(session({
    store: new pgSession({ pool, tableName: 'session', createTableIfMissing: true }),
    secret: config.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      // "strict" - cookie session TIDAK dikirim sama sekali kalau request datang dari
      // situs lain (cross-site), termasuk navigasi biasa dari link eksternal. Ini
      // proteksi utama terhadap CSRF di level cookie, dikombinasikan dengan CSRF
      // token eksplisit untuk request state-changing (lihat middleware/csrf.js).
      sameSite: 'strict',
      maxAge: 8 * 60 * 60 * 1000, // 8 jam
      // secure: true, // aktifkan kalau sudah pakai HTTPS
    },
  }));

  app.use(express.static(path.join(__dirname, '..', 'public')));

  app.use(cookieParser());
  app.use(i18nMiddleware);
  app.use(attachCsrfToken);
  app.use(verifyCsrfToken);

  // Page routes (server-rendered EJS)
  app.use('/', viewRoutes);
  app.use('/admin', adminRoutes);

  // API routes (JSON, dipanggil dari public/js/*.js)
  app.use('/api/auth', authRoutes);
  app.use('/api/containers', containerRoutes);

  // API Gateway - punya autentikasi & rate limit sendiri (API key, bukan session),
  // sengaja dipasang SEBELUM app.use('/api', 404-catch-all) di bawah supaya ke-handle duluan.
  // i18nMiddleware tetap aktif secara global (di atas) tapi controller-nya sengaja
  // TIDAK memakainya - respons API Gateway selalu bahasa Inggris untuk konsumsi
  // sistem lain (lihat komentar di middleware/apiKeyAuth.js).
  app.use('/api/v1', apiV1Routes);

  app.use('/api', (req, res) => {
    res.status(404).json({ success: false, code: 404, message: res.locals.t('common.endpointNotFound'), data: null });
  });

  // Halaman 404 branded (bukan plain text) buat request non-API
  app.use((req, res) => {
    const t = res.locals.t || ((key) => key);
    res.status(404).render('errors/404', { t, lang: res.locals.lang || 'en' });
  });

  app.use((err, req, res, next) => {
    logger.error(`Unhandled error: ${err.message}`, {
      requestId: req.requestId,
      stack: err.stack,
      method: req.method,
      path: req.originalUrl,
    });
    const t = res.locals.t || ((key) => key);
    const message = t('common.serverError');
    if (req.path.startsWith('/api/')) {
      return res.status(500).json({ success: false, code: 500, message, data: null });
    }
    res.status(500).render('errors/500', { t, lang: res.locals.lang || 'en' });
  });

  return app;
}

module.exports = createApp;
