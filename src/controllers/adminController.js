const adminService = require('../services/adminService');
const ServiceError = require('../utils/ServiceError');

function loginPage(req, res) {
  res.render('admin/login', { error: null });
}

async function login(req, res) {
  const { username, password } = req.body;
  try {
    const admin = await adminService.login(username, password);
    req.session.adminId = admin.id;
    req.session.adminUsername = admin.username;
    return res.redirect('/admin');
  } catch (err) {
    const message = err instanceof ServiceError ? err.message : 'Terjadi kesalahan pada server';
    return res.status(err instanceof ServiceError ? 401 : 500).render('admin/login', { error: message });
  }
}

function logout(req, res) {
  req.session.destroy(() => res.redirect('/admin/login'));
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
    console.error('[adminController] Gagal load dashboard:', err);
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
