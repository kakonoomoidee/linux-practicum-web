const express = require('express');
const containerController = require('../controllers/containerController');
const { requireLogin, requirePasswordChanged } = require('../middleware/auth');

const router = express.Router();

router.get('/', requireLogin, containerController.list);
router.post('/', requireLogin, requirePasswordChanged, containerController.create);
router.delete('/:id', requireLogin, containerController.destroy);

module.exports = router;
