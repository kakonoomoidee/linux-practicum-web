const config = require('../config/env');

function loginPage(req, res) {
  res.render('login', { error: null });
}

function changePasswordPage(req, res) {
  if (!req.session || !req.session.nim) return res.redirect('/login');
  res.render('change-password', { error: null });
}

function dashboardPage(req, res) {
  res.render('dashboard', {
    nama: req.session.nama,
    nim: req.session.nim,
    ttlHours: config.container.ttlHours,
  });
}

function root(req, res) {
  if (req.session && req.session.nim) {
    return res.redirect(req.session.firstLogin ? '/change-password' : '/dashboard');
  }
  res.redirect('/login');
}

module.exports = { loginPage, changePasswordPage, dashboardPage, root };
