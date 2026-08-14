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
  message: { success: false, code: 429, message: 'Terlalu banyak percobaan login, coba lagi beberapa menit lagi', data: null },
});

router.post('/login', loginLimiter, authController.login);
router.post('/change-password', requireLogin, authController.changePassword);
router.get('/me', requireLogin, authController.me);
router.post('/logout', requireLogin, authController.logout);

module.exports = router;
