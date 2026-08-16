const containerService = require('../services/containerService');
const ServiceError = require('../utils/ServiceError');
const logger = require('../config/logger');

const errorStatusMap = {
  INSTANCE_NOT_FOUND: 404,
  CONTAINER_LIMIT_REACHED: 409,
  DOCKER_UNREACHABLE: 503,
  DOCKER_SPAWN_FAILED: 502,
  DB_INSERT_FAILED: 500,
};

function handleServiceError(err, res, req) {
  if (err instanceof ServiceError) {
    const status = errorStatusMap[err.code] || 400;
    const message = res.locals.t(`errors.${err.code}`);
    return res.status(status).json({ success: false, code: status, message, data: err.meta || null });
  }
  logger.error(`Unexpected error di containerController: ${err.message}`, { stack: err.stack, requestId: req && req.requestId, nim: req && req.session && req.session.nim });
  return res.status(500).json({ success: false, code: 500, message: res.locals.t('common.serverError'), data: null });
}

async function list(req, res) {
  try {
    const data = await containerService.listForStudent(req.session.nim);
    return res.json({ success: true, code: 200, message: 'OK', data });
  } catch (err) {
    return handleServiceError(err, res, req);
  }
}

async function create(req, res) {
  try {
    const data = await containerService.createForStudent(req.session.nim);
    logger.info(`Container berhasil dibuat`, { nim: req.session.nim, containerName: data.container_name, event: 'container_created' });
    return res.status(201).json({
      success: true,
      code: 201,
      message: res.locals.t('dashboard.createSuccessTitle'),
      data,
    });
  } catch (err) {
    return handleServiceError(err, res, req);
  }
}

async function destroy(req, res) {
  try {
    await containerService.destroyForStudent(req.session.nim, req.params.id);
    logger.info(`Container dihapus mahasiswa`, { nim: req.session.nim, containerId: req.params.id, event: 'container_destroyed_by_student' });
    return res.json({ success: true, code: 200, message: res.locals.t('dashboard.destroySuccessTitle'), data: null });
  } catch (err) {
    return handleServiceError(err, res, req);
  }
}

module.exports = { list, create, destroy };
