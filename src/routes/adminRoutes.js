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
  handler: (req, res) => {
    res.status(429).render('admin/login', { error: res.locals.t('common.rateLimited') });
  },
});

router.get('/login', redirectIfAdminLoggedIn, adminController.loginPage);
router.post('/login', loginLimiter, adminController.login);
router.post('/logout', requireAdmin, adminController.logout);
router.get('/', requireAdmin, adminController.dashboard);
router.get('/logs', requireAdmin, adminController.logsPage);
router.get('/activity-log', requireAdmin, adminController.activityLogPage);
router.post('/instances/:id/destroy', requireAdmin, adminController.destroyInstance);
router.post('/students/:nim/reset-password', requireAdmin, adminController.resetStudentPassword);
router.get('/settings', requireAdmin, adminController.settingsPage);
router.post('/settings/password', requireAdmin, adminController.changeOwnPassword);
router.post('/settings/language', requireAdmin, adminController.updateLanguage);
router.post('/api-keys', requireAdmin, adminController.createApiKey);
router.post('/api-keys/:id/revoke', requireAdmin, adminController.revokeApiKey);

module.exports = router;
