const express = require('express');
const rateLimit = require('express-rate-limit');
const adminController = require('../controllers/adminController');
const { requireAdmin, redirectIfAdminLoggedIn } = require('../middleware/adminAuth');

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
});

router.get('/login', redirectIfAdminLoggedIn, adminController.loginPage);
router.post('/login', loginLimiter, adminController.login);
router.post('/logout', requireAdmin, adminController.logout);
router.get('/', requireAdmin, adminController.dashboard);
router.get('/logs', requireAdmin, adminController.logsPage);
router.post('/instances/:id/destroy', requireAdmin, adminController.destroyInstance);

module.exports = router;
