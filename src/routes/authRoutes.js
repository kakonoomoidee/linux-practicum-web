const express = require('express');
const rateLimit = require('express-rate-limit');
const authController = require('../controllers/authController');
const { requireLogin } = require('../middleware/auth');

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  // "message" statis ga bisa akses res.locals.t() (itu ditentukan per-request
  // berdasarkan bahasa pengguna), makanya pakai "handler" yang jalan per-request.
  handler: (req, res) => {
    res.status(429).json({ success: false, code: 429, message: res.locals.t('common.rateLimited'), data: null });
  },
});

router.post('/login', loginLimiter, authController.login);
router.post('/change-password', requireLogin, authController.changePassword);
router.get('/me', requireLogin, authController.me);
router.post('/logout', requireLogin, authController.logout);

module.exports = router;
