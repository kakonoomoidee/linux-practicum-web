const { query } = require('../db/connection');

const insert = async ({ name, keyPrefix, keyHash, createdBy }) => {
  const { rows } = await query(
    `INSERT INTO api_keys (name, key_prefix, key_hash, created_by)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [name, keyPrefix, keyHash, createdBy]
  );
  return rows[0];
};

const findAllActive = async () => {
  const { rows } = await query(
    'SELECT * FROM api_keys WHERE revoked_at IS NULL ORDER BY created_at DESC',
    []
  );
  return rows;
};

// Dipakai middleware buat validasi - ambil semua key aktif, lalu bcrypt.compare()
// satu-satu di service layer (jumlah API key biasanya kecil, cukup efisien).
const findActiveWithPrefix = async (keyPrefix) => {
  const { rows } = await query(
    'SELECT * FROM api_keys WHERE key_prefix = $1 AND revoked_at IS NULL',
    [keyPrefix]
  );
  return rows;
};

const findById = async (id) => {
  const { rows } = await query('SELECT * FROM api_keys WHERE id = $1', [id]);
  return rows[0] || null;
};

const touchLastUsed = async (id) => {
  await query('UPDATE api_keys SET last_used_at = now() WHERE id = $1', [id]);
};

const revoke = async (id) => {
  await query('UPDATE api_keys SET revoked_at = now() WHERE id = $1 AND revoked_at IS NULL', [id]);
};

module.exports = { insert, findAllActive, findActiveWithPrefix, findById, touchLastUsed, revoke };
