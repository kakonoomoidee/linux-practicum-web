const { validateEnv } = require('./src/config/validateEnv');
const logger = require('./src/config/logger');

// WAJIB paling awal, sebelum modul lain di-require - biar kesalahan konfigurasi
// (secret masih placeholder, dst) ketahuan sebelum apa pun lain dijalankan.
validateEnv(logger);

const createApp = require('./src/app');
const config = require('./src/config/env');
const { pool } = require('./src/db/connection');
const { initSchema } = require('./src/db/initSchema');
const { startCleanupCron } = require('./src/cron/cleanupJob');
const { ensureNetwork } = require('./src/services/dockerService');

const app = createApp();

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

let httpServer = null;
let cronTask = null;
let shuttingDown = false;

function gracefulShutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;

  logger.info(`Menerima sinyal ${signal}, memulai graceful shutdown...`);

  const forceExitTimer = setTimeout(() => {
    logger.error('Graceful shutdown melebihi batas waktu (10 detik), keluar paksa.');
    process.exit(1);
  }, 10_000);
  forceExitTimer.unref();

  if (cronTask) {
    cronTask.stop();
    logger.info('Cron cleanup job dihentikan.');
  }

  if (httpServer) {
    httpServer.close(async (err) => {
      if (err) {
        logger.error(`Error saat menutup HTTP server: ${err.message}`);
      } else {
        logger.info('HTTP server berhenti menerima koneksi baru dan seluruh koneksi aktif sudah selesai.');
      }

      try {
        await pool.end();
        logger.info('Koneksi pool PostgreSQL ditutup dengan bersih.');
      } catch (poolErr) {
        logger.error(`Error saat menutup pool PostgreSQL: ${poolErr.message}`);
      }

      clearTimeout(forceExitTimer);
      process.exit(0);
    });
  } else {
    clearTimeout(forceExitTimer);
    process.exit(0);
  }
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

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

  cronTask = startCleanupCron();

  httpServer = app.listen(config.port, () => {
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
