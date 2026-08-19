const bcrypt = require('bcrypt');
const studentRepository = require('../repositories/studentRepository');
const activityLogRepository = require('../repositories/activityLogRepository');
const config = require('../config/env');
const ServiceError = require('../utils/ServiceError');

async function login(nim, password) {
  if (!nim || !password) {
    throw new ServiceError('NIM dan password wajib diisi', 'MISSING_CREDENTIALS');
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
    preferredLanguage: student.preferred_language,
  };
}

async function changePassword(nim, oldPassword, newPassword) {
  if (!oldPassword || !newPassword) {
    throw new ServiceError('Password lama dan baru wajib diisi', 'MISSING_PASSWORD_FIELDS');
  }

  if (newPassword.length < 8) {
    throw new ServiceError('Password baru minimal 8 karakter', 'PASSWORD_TOO_SHORT');
  }

  if (newPassword === config.auth.defaultPassword) {
    throw new ServiceError('Password baru tidak boleh sama dengan password default', 'PASSWORD_SAME_AS_DEFAULT');
  }

  const student = await studentRepository.findByNim(nim);
  if (!student) {
    throw new ServiceError('Akun tidak ditemukan', 'STUDENT_NOT_FOUND');
  }

  const match = await bcrypt.compare(oldPassword, student.password_hash);
  if (!match) {
    throw new ServiceError('Password lama salah', 'PASSWORD_INCORRECT');
  }

  const newHash = await bcrypt.hash(newPassword, 12);
  await studentRepository.updatePassword(nim, newHash);
  await activityLogRepository.log(nim, 'password_changed');
}

const SUPPORTED_LANGUAGES = ['en', 'id'];

async function updateLanguage(nim, lang) {
  if (!SUPPORTED_LANGUAGES.includes(lang)) {
    throw new ServiceError('Bahasa tidak didukung', 'INVALID_LANGUAGE');
  }
  await studentRepository.updateLanguage(nim, lang);
}

module.exports = { login, changePassword, updateLanguage };
