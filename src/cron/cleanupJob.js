const cron = require('node-cron');
const containerRepository = require('../repositories/containerRepository');
const activityLogRepository = require('../repositories/activityLogRepository');
const dockerService = require('../services/dockerService');
const config = require('../config/env');
const logger = require('../config/logger');

async function cleanupExpiredContainers() {
  const expired = await containerRepository.findExpired(new Date());
  if (expired.length === 0) return;

  logger.info(`Membersihkan ${expired.length} container yang sudah expired...`, { event: 'cron_cleanup_start', count: expired.length });

  for (const row of expired) {
    try {
      await dockerService.destroyContainer(row.container_id);
      await containerRepository.markDestroyed(row.id);
      await activityLogRepository.log(row.nim, 'container_destroyed_ttl', row.container_name);
      logger.info(`Container dihapus (TTL habis)`, {
        nim: row.nim,
        containerName: row.container_name,
        event: 'container_destroyed_ttl',
      });
    } catch (err) {
      // Tetap tandai destroyed di DB walau gagal hapus di Docker,
      // supaya record ga nyangkut selamanya dan mahasiswa tetap bisa bikin container baru.
      logger.error(`Gagal hapus container di Docker, tetap tandai destroyed di DB: ${err.message}`, {
        nim: row.nim,
        containerName: row.container_name,
      });
      await containerRepository.markDestroyed(row.id).catch((e) =>
        logger.error(`Gagal update status juga: ${e.message}`, { nim: row.nim, containerName: row.container_name })
      );
    }
  }
}

function startCleanupCron() {
  cron.schedule(config.cron.cleanupPattern, () => {
    cleanupExpiredContainers().catch((err) => logger.error(`Error saat cleanup: ${err.message}`, { stack: err.stack }));
  });
  logger.info(`Cleanup job aktif dengan pattern: "${config.cron.cleanupPattern}"`, { event: 'cron_job_started' });
}

module.exports = { startCleanupCron, cleanupExpiredContainers };
