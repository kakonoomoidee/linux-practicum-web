const express = require('express');
const rateLimit = require('express-rate-limit');
const apiKeyAuth = require('../middleware/apiKeyAuth');
const apiV1Controller = require('../controllers/apiV1Controller');

const router = express.Router();

// Rate limit per API key (bukan per IP) - key identifier-nya dari header X-API-Key
// mentah (belum di-verify di titik ini, tapi cukup buat throttling; verifikasi
// validitas key tetap dilakukan middleware apiKeyAuth setelahnya).
const gatewayLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.header('X-API-Key') || req.ip,
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      code: 429,
      message: 'Rate limit exceeded (max 60 requests/minute per API key). Please slow down.',
      data: null,
    });
  },
});

// Health check publik - TIDAK butuh API key, TIDAK kena rate limit khusus gateway
// (masih kena rate limiter global kalau ada, tapi didesain buat dipoll rutin).
router.get('/health', apiV1Controller.health);

router.use(gatewayLimiter);
router.use(apiKeyAuth);

router.get('/students', apiV1Controller.listStudents);
router.get('/containers', apiV1Controller.listContainers);

module.exports = router;
