const apiKeyService = require('../services/apiKeyService');
const logger = require('../config/logger');

/**
 * Middleware autentikasi buat API Gateway (/api/v1/*) - terpisah total dari session
 * login di web UI. Sistem eksternal (mis. integrasi Moodle/tool akademik lain)
 * mengirim API key lewat header "X-API-Key".
 *
 * Catatan: response API Gateway sengaja pakai bahasa Inggris konsisten, tidak ikut
 * sistem i18n yang dipakai web UI - ini API buat dikonsumsi sistem lain, bukan
 * manusia yang butuh preferensi bahasa.
 */
async function apiKeyAuth(req, res, next) {
  const rawKey = req.header('X-API-Key');

  if (!rawKey) {
    return res.status(401).json({
      success: false,
      code: 401,
      message: 'API key required. Send it via the "X-API-Key" header.',
      data: null,
    });
  }

  try {
    const keyRecord = await apiKeyService.verifyApiKey(rawKey);
    if (!keyRecord) {
      logger.warn('API Gateway: API key tidak valid/sudah dicabut', { ip: req.ip, event: 'api_key_invalid' });
      return res.status(401).json({ success: false, code: 401, message: 'Invalid or revoked API key.', data: null });
    }

    req.apiKey = { id: keyRecord.id, name: keyRecord.name };
    next();
  } catch (err) {
    logger.error(`API Gateway: error validasi API key: ${err.message}`, { stack: err.stack });
    res.status(500).json({ success: false, code: 500, message: 'Internal server error.', data: null });
  }
}

module.exports = apiKeyAuth;
