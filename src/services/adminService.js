const bcrypt = require('bcrypt');
const adminRepository = require('../repositories/adminRepository');
const containerRepository = require('../repositories/containerRepository');
const studentRepository = require('../repositories/studentRepository');
const dockerService = require('./dockerService');
const activityLogRepository = require('../repositories/activityLogRepository');
const config = require('../config/env');
const ServiceError = require('../utils/ServiceError');
const logger = require('../config/logger');

async function login(username, password) {
  if (!username || !password) {
    throw new ServiceError('Username dan password wajib diisi', 'MISSING_ADMIN_CREDENTIALS');
  }

  const admin = await adminRepository.findByUsername(username.trim());
  if (!admin) {
    throw new ServiceError('Username atau password salah', 'INVALID_ADMIN_CREDENTIALS');
  }

  const match = await bcrypt.compare(password, admin.password_hash);
  if (!match) {
    throw new ServiceError('Username atau password salah', 'INVALID_ADMIN_CREDENTIALS');
  }

  return { id: admin.id, username: admin.username, preferredLanguage: admin.preferred_language };
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
    throw new ServiceError('Instance tidak ditemukan atau sudah tidak aktif', 'INSTANCE_NOT_FOUND');
  }

  try {
    await dockerService.destroyContainer(row.container_id);
  } catch (err) {
    logger.error(`Gagal hapus container di Docker (tetap ditandai destroyed di DB): ${err.message}`, {
      nim: row.nim,
      containerName: row.container_name,
    });
  }

  await containerRepository.markDestroyed(row.id);
  await activityLogRepository.log(row.nim, 'container_destroyed_by_admin', row.container_name);
  logger.info(`Instance dihapus paksa oleh admin`, { nim: row.nim, containerName: row.container_name, event: 'admin_force_destroy' });
}

/**
 * Admin reset password mahasiswa - dipakai kalau mahasiswa lupa password dan ga bisa
 * self-service ganti sendiri. Password baru WAJIB diganti lagi oleh mahasiswa di login
 * berikutnya (first_login di-set true lagi), sama seperti alur akun baru.
 */
async function resetStudentPassword(nim, newPassword) {
  if (!newPassword || newPassword.length < 8) {
    throw new ServiceError('Password baru minimal 8 karakter', 'PASSWORD_TOO_SHORT');
  }

  const student = await studentRepository.findByNim(nim);
  if (!student) {
    throw new ServiceError('Mahasiswa tidak ditemukan', 'STUDENT_NOT_FOUND');
  }

  const newHash = await bcrypt.hash(newPassword, 12);
  await studentRepository.resetPasswordByAdmin(nim, newHash);
  await activityLogRepository.log(nim, 'password_reset_by_admin');
  logger.info(`Password mahasiswa direset oleh admin`, { nim, event: 'admin_reset_password' });
}

/**
 * Admin ganti password akun admin-nya sendiri lewat halaman Settings - sebelumnya
 * ga ada cara self-service buat ini, cuma bisa lewat script seed atau ubah manual di DB.
 */
async function changeOwnPassword(adminId, oldPassword, newPassword) {
  if (!oldPassword || !newPassword) {
    throw new ServiceError('Password lama dan baru wajib diisi', 'MISSING_PASSWORD_FIELDS');
  }

  if (newPassword.length < 8) {
    throw new ServiceError('Password baru minimal 8 karakter', 'PASSWORD_TOO_SHORT');
  }

  const admin = await adminRepository.findById(adminId);
  if (!admin) {
    throw new ServiceError('Akun admin tidak ditemukan', 'ADMIN_NOT_FOUND');
  }

  const match = await bcrypt.compare(oldPassword, admin.password_hash);
  if (!match) {
    throw new ServiceError('Password lama salah', 'PASSWORD_INCORRECT');
  }

  const newHash = await bcrypt.hash(newPassword, 12);
  await adminRepository.updatePassword(adminId, newHash);
  logger.info(`Admin ganti password sendiri`, { adminUsername: admin.username, event: 'admin_self_password_change' });
}

const SUPPORTED_LANGUAGES = ['en', 'id'];

async function updateLanguage(adminId, lang) {
  if (!SUPPORTED_LANGUAGES.includes(lang)) {
    throw new ServiceError('Bahasa tidak didukung', 'INVALID_LANGUAGE');
  }
  await adminRepository.updateLanguage(adminId, lang);
}

/**
 * Data buat halaman /admin/activity-log - riwayat aktivitas SEMUA mahasiswa
 * (login, ganti password, bikin/hapus container, dst), beda dari log server
 * teknis (/admin/logs) yang isinya level error/warn/info dari Winston.
 */
async function getActivityLog({ nim, action, limit } = {}) {
  const [entries, availableActions] = await Promise.all([
    activityLogRepository.findAll({ nim: nim || null, action: action || null, limit: limit || 200 }),
    activityLogRepository.distinctActions(),
  ]);
  return { entries, availableActions };
}

module.exports = {
  login,
  getDashboardData,
  forceDestroyInstance,
  resetStudentPassword,
  changeOwnPassword,
  updateLanguage,
  getActivityLog,
};
