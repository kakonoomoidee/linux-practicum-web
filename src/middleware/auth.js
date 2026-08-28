function requireLogin(req, res, next) {
  if (!req.session || !req.session.nim) {
    // PENTING: pakai req.originalUrl, BUKAN req.path. Middleware ini dipasang di
    // dalam sub-router (mis. containerRoutes yang di-mount di app.use('/api/containers', ...)),
    // dan req.path di dalam konteks sub-router itu RELATIF terhadap mount point
    // (misal jadi "/" bukan "/api/containers/"). req.originalUrl selalu full path
    // dari awal, ga peduli di router mana middleware ini kepasang.
    if (req.originalUrl.startsWith('/api/')) {
      return res.status(401).json({ success: false, code: 401, message: res.locals.t('common.notLoggedIn'), data: null });
    }
    return res.redirect('/login');
  }
  next();
}

function requirePasswordChanged(req, res, next) {
  if (req.session.firstLogin) {
    if (req.originalUrl.startsWith('/api/')) {
      return res.status(403).json({
        success: false,
        code: 403,
        message: res.locals.t('common.mustChangePassword'),
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
