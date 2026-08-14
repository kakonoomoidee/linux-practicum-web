/**
 * Error khusus dari service layer, membawa "code" simbolik (bukan HTTP status)
 * supaya controller yang menentukan HTTP status-nya. Ini menjaga service layer
 * tetap murni logika bisnis, tidak tahu-menahu soal HTTP.
 */
class ServiceError extends Error {
  constructor(message, code = 'SERVICE_ERROR', meta = null) {
    super(message);
    this.name = 'ServiceError';
    this.code = code;
    this.meta = meta;
  }
}

module.exports = ServiceError;
