const adminService = require('../services/adminService');
const logService = require('../services/logService');
const apiKeyService = require('../services/apiKeyService');
const ServiceError = require('../utils/ServiceError');
const logger = require('../config/logger');

const errorStatusMap = {
  MISSING_ADMIN_CREDENTIALS: 400,
  INVALID_ADMIN_CREDENTIALS: 401,
  INSTANCE_NOT_FOUND: 404,
  STUDENT_NOT_FOUND: 404,
  ADMIN_NOT_FOUND: 404,
  PASSWORD_TOO_SHORT: 400,
  MISSING_PASSWORD_FIELDS: 400,
  PASSWORD_INCORRECT: 401,
  INVALID_LANGUAGE: 400,
  MISSING_API_KEY_NAME: 400,
  API_KEY_NOT_FOUND: 404,
};

function handleAjaxError(err, res, req, fallbackAdminUsername) {
  if (err instanceof ServiceError) {
    const status = errorStatusMap[err.code] || 400;
    return res.status(status).json({ success: false, code: status, message: res.locals.t(`errors.${err.code}`), data: null });
  }
  logger.error(`Admin controller error: ${err.message}`, { stack: err.stack, adminUsername: fallbackAdminUsername });
  return res.status(500).json({ success: false, code: 500, message: res.locals.t('common.serverError'), data: null });
}

function loginPage(req, res) {
  res.render('admin/login', { error: null });
}

async function login(req, res) {
  const { username, password } = req.body;
  try {
    const admin = await adminService.login(username, password);
    req.session.adminId = admin.id;
    req.session.adminUsername = admin.username;
    logger.info(`Admin login berhasil`, { adminUsername: admin.username, event: 'admin_login_success' });

    // Sinkronkan cookie bahasa dengan preferensi akun, sama seperti login mahasiswa.
    res.cookie('lang', admin.preferredLanguage, { maxAge: 365 * 24 * 60 * 60 * 1000, httpOnly: false, sameSite: 'lax' });

    return res.redirect('/admin');
  } catch (err) {
    logger.warn(`Percobaan login admin gagal`, { attemptedUsername: username, ip: req.ip, event: 'admin_login_failed' });
    const message = err instanceof ServiceError ? res.locals.t(`errors.${err.code}`) : res.locals.t('common.serverError');
    return res.status(err instanceof ServiceError ? 401 : 500).render('admin/login', { error: message });
  }
}

function logout(req, res) {
  const adminUsername = req.session.adminUsername;
  req.session.destroy(() => {
    logger.info(`Admin logout`, { adminUsername, event: 'admin_logout' });
    res.redirect('/admin/login');
  });
}

async function dashboard(req, res) {
  try {
    const data = await adminService.getDashboardData();
    res.render('admin/dashboard', {
      adminUsername: req.session.adminUsername,
      ...data,
    });
  } catch (err) {
    logger.error(`Gagal load dashboard admin: ${err.message}`, { stack: err.stack, adminUsername: req.session.adminUsername });
    res.status(500).send(res.locals.t('common.serverError'));
  }
}

// Destroy instance - AJAX, dipanggil dari modal konfirmasi di admin/dashboard.ejs
async function destroyInstance(req, res) {
  try {
    await adminService.forceDestroyInstance(req.params.id);
    return res.json({ success: true, code: 200, message: res.locals.t('admin.deleteSuccess'), data: null });
  } catch (err) {
    return handleAjaxError(err, res, req, req.session.adminUsername);
  }
}

// Reset password mahasiswa - AJAX, dipanggil dari modal di admin/dashboard.ejs
async function resetStudentPassword(req, res) {
  try {
    const { new_password } = req.body;
    await adminService.resetStudentPassword(req.params.nim, new_password);
    return res.json({ success: true, code: 200, message: res.locals.t('admin.resetPasswordSuccess'), data: null });
  } catch (err) {
    return handleAjaxError(err, res, req, req.session.adminUsername);
  }
}

async function logsPage(req, res) {
  const level = req.query.level || 'all';
  const search = req.query.q || '';
  const limit = req.query.limit || 200;

  try {
    const result = await logService.readLogs({ level, search, limit });
    res.render('admin/logs', {
      adminUsername: req.session.adminUsername,
      ...result,
      filterLevel: level,
      filterSearch: search,
      filterLimit: limit,
    });
  } catch (err) {
    logger.error(`Gagal baca file log: ${err.message}`, { stack: err.stack, adminUsername: req.session.adminUsername });
    res.status(500).send(res.locals.t('common.serverError'));
  }
}

// ==== Settings ====

async function settingsPage(req, res) {
  try {
    const apiKeys = await apiKeyService.listApiKeys();
    res.render('admin/settings', {
      adminUsername: req.session.adminUsername,
      apiKeys,
    });
  } catch (err) {
    logger.error(`Gagal load halaman settings admin: ${err.message}`, { stack: err.stack, adminUsername: req.session.adminUsername });
    res.status(500).send(res.locals.t('common.serverError'));
  }
}

async function changeOwnPassword(req, res) {
  try {
    const { old_password, new_password } = req.body;
    await adminService.changeOwnPassword(req.session.adminId, old_password, new_password);
    return res.json({ success: true, code: 200, message: res.locals.t('settings.passwordUpdateSuccess'), data: null });
  } catch (err) {
    return handleAjaxError(err, res, req, req.session.adminUsername);
  }
}

async function updateLanguage(req, res) {
  try {
    const { lang } = req.body;
    await adminService.updateLanguage(req.session.adminId, lang);
    res.cookie('lang', lang, { maxAge: 365 * 24 * 60 * 60 * 1000, httpOnly: false, sameSite: 'lax' });
    return res.json({ success: true, code: 200, message: res.locals.t('settings.languageUpdateSuccess'), data: null });
  } catch (err) {
    return handleAjaxError(err, res, req, req.session.adminUsername);
  }
}

// ==== API Key management (bagian dari Settings) ====

async function createApiKey(req, res) {
  try {
    const { name } = req.body;
    const result = await apiKeyService.createApiKey(name, req.session.adminUsername);
    logger.info(`API key dibuat`, { adminUsername: req.session.adminUsername, apiKeyName: result.name, event: 'api_key_created' });
    return res.status(201).json({ success: true, code: 201, message: res.locals.t('admin.apiKeyCreatedTitle'), data: result });
  } catch (err) {
    return handleAjaxError(err, res, req, req.session.adminUsername);
  }
}

async function revokeApiKey(req, res) {
  try {
    await apiKeyService.revokeApiKey(req.params.id);
    logger.info(`API key dicabut`, { adminUsername: req.session.adminUsername, apiKeyId: req.params.id, event: 'api_key_revoked' });
    return res.json({ success: true, code: 200, message: res.locals.t('admin.revokeSuccess'), data: null });
  } catch (err) {
    return handleAjaxError(err, res, req, req.session.adminUsername);
  }
}

module.exports = {
  loginPage,
  login,
  logout,
  dashboard,
  destroyInstance,
  resetStudentPassword,
  logsPage,
  settingsPage,
  changeOwnPassword,
  updateLanguage,
  createApiKey,
  revokeApiKey,
};
