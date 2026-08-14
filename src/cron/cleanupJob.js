const cron = require('node-cron');
const containerRepository = require('../repositories/containerRepository');
const activityLogRepository = require('../repositories/activityLogRepository');
const dockerService = require('../services/dockerService');
const config = require('../config/env');

async function cleanupExpiredContainers() {
  const expired = await containerRepository.findExpired(new Date());
  if (expired.length === 0) return;

  console.log(`[cron] Membersihkan ${expired.length} container yang sudah expired...`);

  for (const row of expired) {
    try {
      await dockerService.destroyContainer(row.container_id);
      await containerRepository.markDestroyed(row.id);
      await activityLogRepository.log(row.nim, 'container_destroyed_ttl', row.container_name);
      console.log(`[cron] Container ${row.container_name} (nim: ${row.nim}) dihapus (TTL habis)`);
    } catch (err) {
      // Tetap tandai destroyed di DB walau gagal hapus di Docker,
      // supaya record ga nyangkut selamanya dan mahasiswa tetap bisa bikin container baru.
      console.error(`[cron] Gagal hapus container ${row.container_name} di Docker, tetap tandai destroyed di DB:`, err.message);
      await containerRepository.markDestroyed(row.id).catch((e) => console.error('[cron] Gagal update status juga:', e.message));
    }
  }
}

function startCleanupCron() {
  cron.schedule(config.cron.cleanupPattern, () => {
    cleanupExpiredContainers().catch((err) => console.error('[cron] Error saat cleanup:', err));
  });
  console.log(`[cron] Cleanup job aktif dengan pattern: "${config.cron.cleanupPattern}"`);
}

module.exports = { startCleanupCron, cleanupExpiredContainers };
