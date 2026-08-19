const { query } = require('../db/connection');

const findByUsername = async (username) => {
  const { rows } = await query('SELECT * FROM admins WHERE username = $1', [username]);
  return rows[0] || null;
};

const findById = async (id) => {
  const { rows } = await query('SELECT * FROM admins WHERE id = $1', [id]);
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

const updatePassword = async (id, passwordHash) => {
  await query('UPDATE admins SET password_hash = $1 WHERE id = $2', [passwordHash, id]);
};

const updateLanguage = async (id, lang) => {
  await query('UPDATE admins SET preferred_language = $1 WHERE id = $2', [lang, id]);
};

module.exports = { findByUsername, findById, insertIfNotExists, updatePassword, updateLanguage };
