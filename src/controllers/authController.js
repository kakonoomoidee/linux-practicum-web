const authService = require('../services/authService');
const ServiceError = require('../utils/ServiceError');

const errorStatusMap = {
  VALIDATION_ERROR: 400,
  INVALID_CREDENTIALS: 401,
  NOT_FOUND: 404,
};

function handleServiceError(err, res) {
  if (err instanceof ServiceError) {
    const status = errorStatusMap[err.code] || 400;
    return res.status(status).json({ success: false, code: status, message: err.message, data: err.meta || null });
  }
  console.error('[authController] Unexpected error:', err);
  return res.status(500).json({ success: false, code: 500, message: 'Terjadi kesalahan pada server', data: null });
}

async function login(req, res) {
  try {
    const { nim, password } = req.body;
    const result = await authService.login(nim, password);

    req.session.nim = result.nim;
    req.session.nama = result.nama;
    req.session.firstLogin = !!result.firstLogin;

    return res.json({
      success: true,
      code: 200,
      message: 'Login berhasil',
      data: { nim: result.nim, nama: result.nama, first_login: !!result.firstLogin },
    });
  } catch (err) {
    return handleServiceError(err, res);
  }
}

async function changePassword(req, res) {
  try {
    const { old_password, new_password } = req.body;
    await authService.changePassword(req.session.nim, old_password, new_password);
    req.session.firstLogin = false;
    return res.json({ success: true, code: 200, message: 'Password berhasil diganti', data: null });
  } catch (err) {
    return handleServiceError(err, res);
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

async function logout(req, res) {
  req.session.destroy(() => {
    res.json({ success: true, code: 200, message: 'Logout berhasil', data: null });
  });
}

module.exports = { login, changePassword, me, logout };
