function requireLogin(req, res, next) {
  if (!req.session || !req.session.nim) {
    if (req.path.startsWith('/api/')) {
      return res.status(401).json({ success: false, code: 401, message: 'Kamu belum login, silakan login dulu', data: null });
    }
    return res.redirect('/login');
  }
  next();
}

function requirePasswordChanged(req, res, next) {
  if (req.session.firstLogin) {
    if (req.path.startsWith('/api/')) {
      return res.status(403).json({
        success: false,
        code: 403,
        message: 'Kamu wajib ganti password default sebelum lanjut',
        data: { redirect: '/change-password' },
      });
    }
    return res.redirect('/change-password');
  }
  next();
}

function redirectIfLoggedIn(req, res, next) {
  if (req.session && req.session.nim) {
    return res.redirect(req.session.firstLogin ? '/change-password' : '/dashboard');
  }
  next();
}

module.exports = { requireLogin, requirePasswordChanged, redirectIfLoggedIn };
