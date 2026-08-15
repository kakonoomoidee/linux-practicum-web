const crypto = require('crypto');
const logger = require('../config/logger');

/**
 * Log setiap HTTP request masuk: method, path, status code, durasi, IP, dan
 * NIM mahasiswa (kalau lagi login) - berguna buat audit trail & debugging.
 *
 * Setiap request dapat "requestId" unik yang juga dikirim balik lewat header
 * X-Request-Id, supaya kalau ada laporan error dari mahasiswa/admin, bisa
 * langsung di-grep di log server tanpa perlu nebak-nebak request mana yang dimaksud.
 */
function requestLogger(req, res, next) {
  const start = Date.now();
  req.requestId = crypto.randomUUID();
  res.setHeader('X-Request-Id', req.requestId);

  res.on('finish', () => {
    const durationMs = Date.now() - start;
    const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'http';

    logger.log(level, `${req.method} ${req.originalUrl} ${res.statusCode} - ${durationMs}ms`, {
      requestId: req.requestId,
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      durationMs,
      ip: req.ip,
      nim: req.session && req.session.nim ? req.session.nim : undefined,
    });
  });

  next();
}

module.exports = requestLogger;
