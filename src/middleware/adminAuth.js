function requireAdmin(req, res, next) {
  if (!req.session || !req.session.adminId) {
    // Semua route yang pakai requireAdmin itu GET (page load: dashboard/logs/settings)
    // atau POST (aksi AJAX: destroy instance, reset password, dst). Untuk GET, redirect
    // ke halaman login masuk akal (navigasi browser biasa). Untuk method lain, frontend
    // JS-nya manggil lewat fetch() dan expect response JSON, bukan halaman HTML redirect.
    if (req.method === 'GET') {
      return res.redirect('/admin/login');
    }
    const t = res.locals.t || ((key) => key);
    return res.status(401).json({ success: false, code: 401, message: t('common.notLoggedIn'), data: null });
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
