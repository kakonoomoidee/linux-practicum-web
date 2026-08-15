const bcrypt = require('bcrypt');
const containerRepository = require('../repositories/containerRepository');
const activityLogRepository = require('../repositories/activityLogRepository');
const dockerService = require('./dockerService');
const config = require('../config/env');
const ServiceError = require('../utils/ServiceError');
const logger = require('../config/logger');

function toPublicContainer(row) {
  return {
    id: row.id,
    container_name: row.container_name,
    status: row.status,
    ssh_host: config.ssh.hostDisplay,
    ssh_port: row.ssh_port,
    ssh_username: row.linux_username,
    ssh_command: `ssh ${row.linux_username}@${config.ssh.hostDisplay} -p ${row.ssh_port}`,
    created_at: row.created_at,
    expires_at: row.expires_at,
  };
}

async function listForStudent(nim) {
  const rows = await containerRepository.findRunningByNim(nim);
  return rows.map(toPublicContainer);
}

/**
 * Bikin container baru buat mahasiswa.
 *
 * Ada 2 lapis penanganan error di sini yang secara khusus mengatasi masalah
 * "container nyangkut di DB padahal udah ga ada di Docker, jadi mahasiswa
 * keblokir bikin container baru sampai admin hapus row manual":
 *
 * 1. SELF-HEALING CHECK — sebelum nolak karena "sudah punya container aktif",
 *    kita verifikasi LANGSUNG ke Docker Engine apakah container itu masih
 *    beneran hidup. Kalau ternyata sudah tidak ada (dihapus manual, crash,
 *    dsb), record lama otomatis ditandai 'destroyed' dan mahasiswa tetap
 *    bisa lanjut bikin yang baru — tidak perlu admin turun tangan.
 *
 * 2. COMPENSATING TRANSACTION — kalau container BERHASIL dibuat di Docker
 *    tapi gagal disimpan ke database (misal koneksi DB putus di tengah),
 *    kita rollback dengan menghapus container yang baru dibuat itu di Docker,
 *    supaya tidak ada container "orphan" yang jalan tapi tidak tercatat.
 */
async function createForStudent(nim) {
  const existing = await containerRepository.findFirstRunningByNim(nim);

  if (existing) {
    let stillAlive;
    try {
      stillAlive = await dockerService.isContainerAlive(existing.container_id);
    } catch (err) {
      // Docker daemon lagi bermasalah - jangan asal hapus record, lebih aman gagalkan dengan pesan jelas
      logger.error(`Gagal cek status container ke Docker Engine: ${err.message}`, { nim, containerId: existing.container_id });
      throw new ServiceError(
        'Gagal menghubungi Docker Engine untuk memverifikasi container lama. Coba lagi sebentar lagi.',
        'DOCKER_UNREACHABLE'
      );
    }

    if (stillAlive) {
      throw new ServiceError(
        `Kamu sudah punya ${config.container.maxPerStudent} container aktif. Hapus dulu sebelum bikin baru.`,
        'CONTAINER_LIMIT_REACHED',
        { existing: toPublicContainer(existing) }
      );
    }

    // Self-healing: record di DB basi (container-nya udah ga ada di Docker) -> bersihin otomatis
    await containerRepository.markDestroyed(existing.id);
    await activityLogRepository.log(nim, 'container_auto_cleaned_stale', existing.container_name);
    logger.warn(`Auto-cleaned record basi (container sudah tidak ada di Docker)`, {
      nim,
      containerName: existing.container_name,
      containerId: existing.container_id,
      event: 'container_self_heal',
    });
  }

  const activeCount = await containerRepository.countRunningByNim(nim);
  if (activeCount >= config.container.maxPerStudent) {
    throw new ServiceError(
      `Kamu sudah punya ${config.container.maxPerStudent} container aktif. Hapus dulu sebelum bikin baru.`,
      'CONTAINER_LIMIT_REACHED'
    );
  }

  let spawnResult;
  try {
    const usedPorts = await containerRepository.findAllRunningPorts();
    spawnResult = await dockerService.spawnContainer(nim, usedPorts);
  } catch (err) {
    logger.error(`Gagal spawn container di Docker: ${err.message}`, { nim, stack: err.stack });
    throw new ServiceError(
      'Gagal membuat container di Docker Engine. Coba lagi atau hubungi asisten dosen.',
      'DOCKER_SPAWN_FAILED'
    );
  }

  try {
    const expiresAt = new Date(Date.now() + config.container.ttlHours * 60 * 60 * 1000);
    const passwordHash = await bcrypt.hash(spawnResult.linuxPassword, 10);

    const row = await containerRepository.insert({
      nim,
      containerId: spawnResult.containerId,
      containerName: spawnResult.containerName,
      sshPort: spawnResult.sshPort,
      linuxUsername: spawnResult.linuxUsername,
      passwordHash,
      expiresAt,
    });

    await activityLogRepository.log(nim, 'container_created', spawnResult.containerName);

    return {
      ...toPublicContainer(row),
      ssh_password: spawnResult.linuxPassword, // ditampilkan sekali saja ke caller
    };
  } catch (err) {
    logger.error(`Gagal simpan container ke DB, rollback container di Docker...: ${err.message}`, { nim, containerName: spawnResult.containerName, stack: err.stack });
    try {
      await dockerService.destroyContainer(spawnResult.containerId);
      logger.warn(`Rollback sukses: container dihapus lagi dari Docker`, { nim, containerName: spawnResult.containerName, event: 'container_rollback' });
    } catch (cleanupErr) {
      // Ini kasus terburuk: container jadi orphan (jalan tapi ga tercatat di DB).
      // Log sejelas mungkin biar gampang ditemukan & dibersihkan manual oleh admin.
      logger.error(`ROLLBACK GAGAL - container kemungkinan jadi ORPHAN di Docker, perlu dicek manual oleh admin`, {
        nim,
        containerName: spawnResult.containerName,
        containerId: spawnResult.containerId,
        cleanupError: cleanupErr.message,
        event: 'container_orphan_warning',
      });
    }
    throw new ServiceError(
      'Gagal menyimpan data container ke database. Perubahan sudah di-rollback otomatis, silakan coba lagi.',
      'DB_INSERT_FAILED'
    );
  }
}

async function destroyForStudent(nim, containerDbId) {
  const row = await containerRepository.findRunningByIdAndNim(containerDbId, nim);
  if (!row) {
    throw new ServiceError('Container tidak ditemukan', 'NOT_FOUND');
  }

  try {
    await dockerService.destroyContainer(row.container_id);
  } catch (err) {
    // Tetap lanjut tandai destroyed di DB walau hapus di Docker gagal,
    // supaya mahasiswa tidak keblokir - tapi log biar admin bisa cross-check.
    logger.error(`Gagal hapus container di Docker, tetap tandai destroyed di DB: ${err.message}`, { nim, containerName: row.container_name });
  }

  await containerRepository.markDestroyed(row.id);
  await activityLogRepository.log(nim, 'container_destroyed_manual', row.container_name);
}

module.exports = { listForStudent, createForStudent, destroyForStudent, toPublicContainer };
