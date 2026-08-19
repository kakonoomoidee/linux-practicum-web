const studentRepository = require('../repositories/studentRepository');
const containerRepository = require('../repositories/containerRepository');
const packageJson = require('../../package.json');
const logger = require('../config/logger');

// Endpoint publik, TIDAK butuh API key - buat monitoring/uptime check dari luar.
function health(req, res) {
  res.json({
    success: true,
    code: 200,
    message: 'OK',
    data: { status: 'ok', version: packageJson.version, timestamp: new Date().toISOString() },
  });
}

// GET /api/v1/students - daftar mahasiswa terdaftar (read-only, TANPA data sensitif
// seperti password_hash sama sekali - dijamin di level query, lihat studentRepository.findAll).
async function listStudents(req, res) {
  try {
    const students = await studentRepository.findAll();
    res.json({
      success: true,
      code: 200,
      message: 'OK',
      data: students.map((s) => ({
        nim: s.nim,
        nama: s.nama,
        first_login: s.first_login,
        created_at: s.created_at,
      })),
    });
  } catch (err) {
    logger.error(`API Gateway listStudents error: ${err.message}`, { stack: err.stack, apiKeyName: req.apiKey?.name });
    res.status(500).json({ success: false, code: 500, message: 'Internal server error.', data: null });
  }
}

// GET /api/v1/containers - daftar container yang sedang aktif (read-only)
async function listContainers(req, res) {
  try {
    const rows = await containerRepository.findAllRunningWithStudent();
    res.json({
      success: true,
      code: 200,
      message: 'OK',
      data: rows.map((r) => ({
        nim: r.nim,
        nama: r.student_nama,
        container_name: r.container_name,
        created_at: r.created_at,
        expires_at: r.expires_at,
      })),
    });
  } catch (err) {
    logger.error(`API Gateway listContainers error: ${err.message}`, { stack: err.stack, apiKeyName: req.apiKey?.name });
    res.status(500).json({ success: false, code: 500, message: 'Internal server error.', data: null });
  }
}

module.exports = { health, listStudents, listContainers };
