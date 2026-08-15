const adminService = require('../services/adminService');
const ServiceError = require('../utils/ServiceError');
const logger = require('../config/logger');

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
    const message = err instanceof ServiceError ? err.message : 'Terjadi kesalahan pada server';
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
      notice: req.query.notice || null,
    });
  } catch (err) {
    logger.error(`Gagal load dashboard admin: ${err.message}`, { stack: err.stack, adminUsername: req.session.adminUsername });
    res.status(500).send('Gagal memuat data dashboard admin. Cek log server.');
  }
}

async function destroyInstance(req, res) {
  try {
    await adminService.forceDestroyInstance(req.params.id);
    return res.redirect('/admin?notice=Instance berhasil dihapus');
  } catch (err) {
    const message = err instanceof ServiceError ? err.message : 'Gagal menghapus instance';
    return res.redirect(`/admin?notice=${encodeURIComponent(message)}`);
  }
}

module.exports = { loginPage, login, logout, dashboard, destroyInstance };
