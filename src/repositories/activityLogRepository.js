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

module.exports = { log, recentByNim };
