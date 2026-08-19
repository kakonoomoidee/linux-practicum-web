require('dotenv').config();
const express = require('express');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const cookieParser = require('cookie-parser');
const path = require('path');

const config = require('./src/config/env');
const logger = require('./src/config/logger');
const requestLogger = require('./src/middleware/requestLogger');
const i18nMiddleware = require('./src/middleware/i18n');
const { pool } = require('./src/db/connection');
const { initSchema } = require('./src/db/initSchema');

const viewRoutes = require('./src/routes/viewRoutes');
const authRoutes = require('./src/routes/authRoutes');
const containerRoutes = require('./src/routes/containerRoutes');
const adminRoutes = require('./src/routes/adminRoutes');
const apiV1Routes = require('./src/routes/apiV1Routes');

const { startCleanupCron } = require('./src/cron/cleanupJob');
const { ensureNetwork } = require('./src/services/dockerService');

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

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
    maxAge: 8 * 60 * 60 * 1000, // 8 jam
    // secure: true, // aktifkan kalau sudah pakai HTTPS
  },
}));

app.use(express.static(path.join(__dirname, 'public')));

app.use(cookieParser());
app.use(i18nMiddleware);

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

app.use((req, res) => {
  res.status(404).send(res.locals.t('common.pageNotFound'));
});

app.use((err, req, res, next) => {
  logger.error(`Unhandled error: ${err.message}`, {
    requestId: req.requestId,
    stack: err.stack,
    method: req.method,
    path: req.originalUrl,
  });
  const message = res.locals.t ? res.locals.t('common.serverError') : 'Something went wrong.';
  if (req.path.startsWith('/api/')) {
    return res.status(500).json({ success: false, code: 500, message, data: null });
  }
  res.status(500).send(message);
});

/**
 * Retry connect ke DB beberapa kali sebelum nyerah.
 * Berguna terutama di Docker Compose: walau ada healthcheck di service "db",
 * kadang masih ada jeda singkat sebelum PostgreSQL beneran siap terima koneksi.
 */
async function initSchemaWithRetry(maxAttempts = 10, delayMs = 3000) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await initSchema();
      return;
    } catch (err) {
      if (attempt === maxAttempts) throw err;
      logger.warn(`Belum bisa konek ke PostgreSQL (percobaan ${attempt}/${maxAttempts}): ${err.message}`);
      logger.warn(`Coba lagi dalam ${delayMs / 1000} detik...`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}

async function start() {
  try {
    await initSchemaWithRetry();
  } catch (err) {
    logger.error(`Gagal konek/setup PostgreSQL setelah beberapa kali percobaan: ${err.message}`, { stack: err.stack });
    process.exit(1);
  }

  try {
    await ensureNetwork();
  } catch (err) {
    logger.warn(`Gagal setup Docker network di awal (akan dicoba lagi saat create container): ${err.message}`);
  }

  startCleanupCron();

  app.listen(config.port, () => {
    logger.info(`Server jalan di http://localhost:${config.port}`, {
      dashboardMahasiswa: `http://localhost:${config.port}/login`,
      dashboardAdmin: `http://localhost:${config.port}/admin/login`,
      sshHost: config.ssh.hostDisplay,
      sshHostSource: config.ssh.hostDisplaySource,
      logLevel: logger.level,
      logDir: process.env.LOG_DIR || 'logs/',
    });
    if (config.ssh.hostDisplaySource.startsWith('fallback')) {
      logger.warn('Auto-detect IP gagal total, mahasiswa TIDAK akan bisa SSH pakai host ini. Isi SSH_HOST_DISPLAY manual di .env dengan IP LAN server yang benar.');
    }
  });
}

start();
