const express = require('express');
const viewController = require('../controllers/viewController');
const { requireLogin, requirePasswordChanged, redirectIfLoggedIn } = require('../middleware/auth');

const router = express.Router();

router.get('/', viewController.root);
router.get('/login', redirectIfLoggedIn, viewController.loginPage);
router.get('/change-password', requireLogin, viewController.changePasswordPage);
router.get('/dashboard', requireLogin, requirePasswordChanged, viewController.dashboardPage);
router.get('/settings', requireLogin, requirePasswordChanged, viewController.settingsPage);

module.exports = router;
