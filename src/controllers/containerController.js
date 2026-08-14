const containerService = require('../services/containerService');
const ServiceError = require('../utils/ServiceError');

const errorStatusMap = {
  VALIDATION_ERROR: 400,
  NOT_FOUND: 404,
  CONTAINER_LIMIT_REACHED: 409,
  DOCKER_UNREACHABLE: 503,
  DOCKER_SPAWN_FAILED: 502,
  DB_INSERT_FAILED: 500,
};

function handleServiceError(err, res) {
  if (err instanceof ServiceError) {
    const status = errorStatusMap[err.code] || 400;
    return res.status(status).json({ success: false, code: status, message: err.message, data: err.meta || null });
  }
  console.error('[containerController] Unexpected error:', err);
  return res.status(500).json({ success: false, code: 500, message: 'Terjadi kesalahan pada server', data: null });
}

async function list(req, res) {
  try {
    const data = await containerService.listForStudent(req.session.nim);
    return res.json({ success: true, code: 200, message: 'OK', data });
  } catch (err) {
    return handleServiceError(err, res);
  }
}

async function create(req, res) {
  try {
    const data = await containerService.createForStudent(req.session.nim);
    return res.status(201).json({
      success: true,
      code: 201,
      message: `Container berhasil dibuat`,
      data,
    });
  } catch (err) {
    return handleServiceError(err, res);
  }
}

async function destroy(req, res) {
  try {
    await containerService.destroyForStudent(req.session.nim, req.params.id);
    return res.json({ success: true, code: 200, message: 'Container berhasil dihapus', data: null });
  } catch (err) {
    return handleServiceError(err, res);
  }
}

module.exports = { list, create, destroy };
