function requireAdmin(req, res, next) {
  if (!req.session || !req.session.adminId) {
    return res.redirect('/admin/login');
  }
  next();
}

function redirectIfAdminLoggedIn(req, res, next) {
  if (req.session && req.session.adminId) {
    return res.redirect('/admin');
  }
  next();
}

module.exports = { requireAdmin, redirectIfAdminLoggedIn };
