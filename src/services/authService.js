const bcrypt = require('bcrypt');
const studentRepository = require('../repositories/studentRepository');
const activityLogRepository = require('../repositories/activityLogRepository');
const config = require('../config/env');
const ServiceError = require('../utils/ServiceError');

async function login(nim, password) {
  if (!nim || !password) {
    throw new ServiceError('NIM dan password wajib diisi', 'VALIDATION_ERROR');
  }

  const student = await studentRepository.findByNim(nim.trim());
  if (!student) {
    throw new ServiceError('NIM atau password salah', 'INVALID_CREDENTIALS');
  }

  const match = await bcrypt.compare(password, student.password_hash);
  if (!match) {
    await activityLogRepository.log(nim, 'login_failed');
    throw new ServiceError('NIM atau password salah', 'INVALID_CREDENTIALS');
  }

  await activityLogRepository.log(nim, 'login_success');

  return {
    nim: student.nim,
    nama: student.nama,
    firstLogin: student.first_login,
  };
}

async function changePassword(nim, oldPassword, newPassword) {
  if (!oldPassword || !newPassword) {
    throw new ServiceError('Password lama dan baru wajib diisi', 'VALIDATION_ERROR');
  }

  if (newPassword.length < 8) {
    throw new ServiceError('Password baru minimal 8 karakter', 'VALIDATION_ERROR');
  }

  if (newPassword === config.auth.defaultPassword) {
    throw new ServiceError('Password baru tidak boleh sama dengan password default', 'VALIDATION_ERROR');
  }

  const student = await studentRepository.findByNim(nim);
  if (!student) {
    throw new ServiceError('Akun tidak ditemukan', 'NOT_FOUND');
  }

  const match = await bcrypt.compare(oldPassword, student.password_hash);
  if (!match) {
    throw new ServiceError('Password lama salah', 'INVALID_CREDENTIALS');
  }

  const newHash = await bcrypt.hash(newPassword, 12);
  await studentRepository.updatePassword(nim, newHash);
  await activityLogRepository.log(nim, 'password_changed');
}

module.exports = { login, changePassword };
