const { query } = require('../db/connection');

const log = async (nim, action, detail = '') => {
  await query('INSERT INTO activity_log (nim, action, detail) VALUES ($1, $2, $3)', [nim, action, detail]);
};

const recentByNim = async (nim, limit = 20) => {
  const { rows } = await query(
    'SELECT * FROM activity_log WHERE nim = $1 ORDER BY created_at DESC LIMIT $2',
    [nim, limit]
  );
  return rows;
};

/**
 * Dipakai halaman admin (/admin/activity-log) - daftar aktivitas SEMUA mahasiswa
 * dengan filter opsional per NIM/jenis aksi, di-join sama nama mahasiswa biar
 * ga cuma nampilin NIM doang.
 */
const findAll = async ({ nim = null, action = null, limit = 200 } = {}) => {
  const { rows } = await query(
    `SELECT al.*, s.nama as student_nama
     FROM activity_log al
     LEFT JOIN students s ON s.nim = al.nim
     WHERE ($1::text IS NULL OR al.nim = $1)
       AND ($2::text IS NULL OR al.action = $2)
     ORDER BY al.created_at DESC
     LIMIT $3`,
    [nim, action, limit]
  );
  return rows;
};

// Dipakai buat isi dropdown filter "jenis aksi" di halaman admin - diambil
// langsung dari data yang ada, bukan hardcoded, jadi selalu akurat.
const distinctActions = async () => {
  const { rows } = await query('SELECT DISTINCT action FROM activity_log ORDER BY action', []);
  return rows.map((r) => r.action);
};

module.exports = { log, recentByNim, findAll, distinctActions };
