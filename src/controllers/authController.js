const authService = require('../services/authService');
const ServiceError = require('../utils/ServiceError');
const logger = require('../config/logger');

const errorStatusMap = {
  MISSING_CREDENTIALS: 400,
  INVALID_CREDENTIALS: 401,
  MISSING_PASSWORD_FIELDS: 400,
  PASSWORD_TOO_SHORT: 400,
  PASSWORD_SAME_AS_DEFAULT: 400,
  PASSWORD_INCORRECT: 401,
  STUDENT_NOT_FOUND: 404,
  INVALID_LANGUAGE: 400,
};

function handleServiceError(err, res, req) {
  if (err instanceof ServiceError) {
    const status = errorStatusMap[err.code] || 400;
    const message = res.locals.t(`errors.${err.code}`);
    return res.status(status).json({ success: false, code: status, message, data: err.meta || null });
  }
  logger.error(`Unexpected error di authController: ${err.message}`, { stack: err.stack, requestId: req && req.requestId });
  return res.status(500).json({ success: false, code: 500, message: res.locals.t('common.serverError'), data: null });
}

async function login(req, res) {
  try {
    const { nim, password, remember_me } = req.body;
    const result = await authService.login(nim, password);

    req.session.nim = result.nim;
    req.session.nama = result.nama;
    req.session.firstLogin = !!result.firstLogin;

    // "Ingat saya" - perpanjang umur cookie session dari default 8 jam jadi 30 hari.
    // Kalau tidak dicentang, biarin default (session lebih pendek, lebih aman
    // buat yang login dari komputer/lab bersama).
    if (remember_me) {
      req.session.cookie.maxAge = 30 * 24 * 60 * 60 * 1000; // 30 hari
    }

    // Sinkronkan cookie bahasa browser dengan preferensi yang tersimpan di akun -
    // preferensi akun jadi "sumber kebenaran" begitu user login, menang atas cookie
    // browser yang mungkin basi (misal login dari browser/device lain).
    res.cookie('lang', result.preferredLanguage, { maxAge: 365 * 24 * 60 * 60 * 1000, httpOnly: false, sameSite: 'lax' });

    return res.json({
      success: true,
      code: 200,
      message: res.locals.t('common.loginSuccess'),
      data: { nim: result.nim, nama: result.nama, first_login: !!result.firstLogin },
    });
  } catch (err) {
    if (err instanceof ServiceError && err.code === 'INVALID_CREDENTIALS') {
      logger.warn(`Percobaan login mahasiswa gagal`, { attemptedNim: req.body.nim, ip: req.ip, event: 'student_login_failed' });
    }
    return handleServiceError(err, res, req);
  }
}

async function changePassword(req, res) {
  try {
    const { old_password, new_password } = req.body;
    await authService.changePassword(req.session.nim, old_password, new_password);
    req.session.firstLogin = false;
    logger.info(`Password berhasil diganti`, { nim: req.session.nim, event: 'password_changed' });
    return res.json({ success: true, code: 200, message: res.locals.t('changePassword.successMessage'), data: null });
  } catch (err) {
    return handleServiceError(err, res, req);
  }
}

async function me(req, res) {
  return res.json({
    success: true,
    code: 200,
    message: 'OK',
    data: { nim: req.session.nim, nama: req.session.nama, first_login: !!req.session.firstLogin },
  });
}

async function updateLanguage(req, res) {
  try {
    const { lang } = req.body;
    await authService.updateLanguage(req.session.nim, lang);
    res.cookie('lang', lang, { maxAge: 365 * 24 * 60 * 60 * 1000, httpOnly: false, sameSite: 'lax' });
    return res.json({ success: true, code: 200, message: res.locals.t('settings.languageUpdateSuccess'), data: null });
  } catch (err) {
    return handleServiceError(err, res, req);
  }
}

async function logout(req, res) {
  const nim = req.session.nim;
  const t = res.locals.t;
  req.session.destroy(() => {
    logger.info(`Logout`, { nim, event: 'student_logout' });
    res.json({ success: true, code: 200, message: t('common.logoutSuccess'), data: null });
  });
}

module.exports = { login, changePassword, me, logout, updateLanguage };
