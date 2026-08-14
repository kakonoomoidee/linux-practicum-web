const bcrypt = require('bcrypt');
const adminRepository = require('../repositories/adminRepository');
const containerRepository = require('../repositories/containerRepository');
const dockerService = require('./dockerService');
const activityLogRepository = require('../repositories/activityLogRepository');
const config = require('../config/env');
const ServiceError = require('../utils/ServiceError');

async function login(username, password) {
  if (!username || !password) {
    throw new ServiceError('Username dan password wajib diisi', 'VALIDATION_ERROR');
  }

  const admin = await adminRepository.findByUsername(username.trim());
  if (!admin) {
    throw new ServiceError('Username atau password salah', 'INVALID_CREDENTIALS');
  }

  const match = await bcrypt.compare(password, admin.password_hash);
  if (!match) {
    throw new ServiceError('Username atau password salah', 'INVALID_CREDENTIALS');
  }

  return { id: admin.id, username: admin.username };
}

/**
 * Data buat halaman admin: instance yang sedang jalan + statistik pemakaian per mahasiswa.
 */
async function getDashboardData() {
  const [runningInstances, usageStats, summary] = await Promise.all([
    containerRepository.findAllRunningWithStudent(),
    containerRepository.getUsageStatsPerStudent(),
    containerRepository.getSummaryStats(),
  ]);

  const hostDisplay = config.ssh.hostDisplay;

  return {
    summary,
    runningInstances: runningInstances.map((row) => ({
      id: row.id,
      nim: row.nim,
      nama: row.student_nama,
      container_name: row.container_name,
      ssh_command: `ssh ${row.linux_username}@${hostDisplay} -p ${row.ssh_port}`,
      created_at: row.created_at,
      expires_at: row.expires_at,
    })),
    usageStats,
  };
}

/**
 * Admin force-destroy sebuah instance (misal buat bebasin mahasiswa yang statenya nyangkut,
 * tanpa perlu utak-atik database manual).
 */
async function forceDestroyInstance(containerDbId) {
  const row = await containerRepository.findById(containerDbId);
  if (!row || row.status !== 'running') {
    throw new ServiceError('Instance tidak ditemukan atau sudah tidak aktif', 'NOT_FOUND');
  }

  try {
    await dockerService.destroyContainer(row.container_id);
  } catch (err) {
    console.error(`[adminService] Gagal hapus container "${row.container_name}" di Docker (tetap ditandai destroyed di DB):`, err.message);
  }

  await containerRepository.markDestroyed(row.id);
  await activityLogRepository.log(row.nim, 'container_destroyed_by_admin', row.container_name);
}

module.exports = { login, getDashboardData, forceDestroyInstance };
