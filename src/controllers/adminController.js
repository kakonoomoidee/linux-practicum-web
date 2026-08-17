const adminService = require('../services/adminService');
const logService = require('../services/logService');
const ServiceError = require('../utils/ServiceError');
const logger = require('../config/logger');

const errorStatusMap = {
  MISSING_ADMIN_CREDENTIALS: 400,
  INVALID_ADMIN_CREDENTIALS: 401,
  INSTANCE_NOT_FOUND: 404,
  STUDENT_NOT_FOUND: 404,
  PASSWORD_TOO_SHORT: 400,
};

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
    if (err instanceof ServiceError) {
      const status = errorStatusMap[err.code] || 400;
      return res.status(status).json({ success: false, code: status, message: res.locals.t(`errors.${err.code}`), data: null });
    }
    logger.error(`Gagal hapus instance: ${err.message}`, { stack: err.stack, adminUsername: req.session.adminUsername });
    return res.status(500).json({ success: false, code: 500, message: res.locals.t('common.serverError'), data: null });
  }
}

// Reset password mahasiswa - AJAX, dipanggil dari modal di admin/dashboard.ejs
async function resetStudentPassword(req, res) {
  try {
    const { new_password } = req.body;
    await adminService.resetStudentPassword(req.params.nim, new_password);
    return res.json({ success: true, code: 200, message: res.locals.t('admin.resetPasswordSuccess'), data: null });
  } catch (err) {
    if (err instanceof ServiceError) {
      const status = errorStatusMap[err.code] || 400;
      return res.status(status).json({ success: false, code: status, message: res.locals.t(`errors.${err.code}`), data: null });
    }
    logger.error(`Gagal reset password mahasiswa: ${err.message}`, { stack: err.stack, adminUsername: req.session.adminUsername });
    return res.status(500).json({ success: false, code: 500, message: res.locals.t('common.serverError'), data: null });
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

module.exports = { loginPage, login, logout, dashboard, destroyInstance, resetStudentPassword, logsPage };
