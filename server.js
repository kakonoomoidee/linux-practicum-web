require('dotenv').config();
const express = require('express');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const path = require('path');

const config = require('./src/config/env');
const logger = require('./src/config/logger');
const requestLogger = require('./src/middleware/requestLogger');
const { pool } = require('./src/db/connection');
const { initSchema } = require('./src/db/initSchema');

const viewRoutes = require('./src/routes/viewRoutes');
const authRoutes = require('./src/routes/authRoutes');
const containerRoutes = require('./src/routes/containerRoutes');
const adminRoutes = require('./src/routes/adminRoutes');

const { startCleanupCron } = require('./src/cron/cleanupJob');
const { ensureNetwork } = require('./src/services/dockerService');

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Kalau app di belakang reverse proxy (nginx dll), ini bikin req.ip ambil IP asli
// mahasiswa dari header X-Forwarded-For, bukan IP proxy-nya. Aman diaktifkan
// walau ga pakai proxy sekalipun.
app.set('trust proxy', true);

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

// Page routes (server-rendered EJS)
app.use('/', viewRoutes);
app.use('/admin', adminRoutes);

// API routes (JSON, dipanggil dari public/js/*.js)
app.use('/api/auth', authRoutes);
app.use('/api/containers', containerRoutes);

app.use('/api', (req, res) => {
  res.status(404).json({ success: false, code: 404, message: 'Endpoint tidak ditemukan', data: null });
});

app.use((req, res) => {
  res.status(404).send('Halaman tidak ditemukan');
});

app.use((err, req, res, next) => {
  logger.error(`Unhandled error: ${err.message}`, {
    requestId: req.requestId,
    stack: err.stack,
    method: req.method,
    path: req.originalUrl,
  });
  if (req.path.startsWith('/api/')) {
    return res.status(500).json({ success: false, code: 500, message: 'Terjadi kesalahan pada server', data: null });
  }
  res.status(500).send('Terjadi kesalahan pada server');
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
