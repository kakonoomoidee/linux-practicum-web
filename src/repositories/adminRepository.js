const { query } = require('../db/connection');

const findByUsername = async (username) => {
  const { rows } = await query('SELECT * FROM admins WHERE username = $1', [username]);
  return rows[0] || null;
};

const insertIfNotExists = async (username, passwordHash) => {
  const { rows } = await query(
    `INSERT INTO admins (username, password_hash)
     VALUES ($1, $2)
     ON CONFLICT (username) DO NOTHING
     RETURNING id`,
    [username, passwordHash]
  );
  return rows.length > 0;
};

module.exports = { findByUsername, insertIfNotExists };
