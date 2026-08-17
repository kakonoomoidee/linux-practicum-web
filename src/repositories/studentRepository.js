const { query } = require('../db/connection');

const findByNim = async (nim) => {
  const { rows } = await query('SELECT * FROM students WHERE nim = $1', [nim]);
  return rows[0] || null;
};

const updatePassword = async (nim, passwordHash) => {
  await query(
    'UPDATE students SET password_hash = $1, first_login = FALSE, updated_at = now() WHERE nim = $2',
    [passwordHash, nim]
  );
};

/**
 * Reset password oleh admin (beda dari updatePassword di atas yang dipakai mahasiswa
 * ganti password sendiri) - first_login sengaja di-set TRUE lagi, supaya mahasiswa
 * WAJIB ganti password ini di login berikutnya (password dari admin dianggap sementara).
 */
const resetPasswordByAdmin = async (nim, passwordHash) => {
  await query(
    'UPDATE students SET password_hash = $1, first_login = TRUE, updated_at = now() WHERE nim = $2',
    [passwordHash, nim]
  );
};

const insertIfNotExists = async (nim, nama, passwordHash) => {
  const { rows } = await query(
    `INSERT INTO students (nim, nama, password_hash, first_login)
     VALUES ($1, $2, $3, TRUE)
     ON CONFLICT (nim) DO NOTHING
     RETURNING nim`,
    [nim, nama, passwordHash]
  );
  return rows.length > 0; // true kalau baru ditambahkan, false kalau sudah ada (skip)
};

const countAll = async () => {
  const { rows } = await query('SELECT COUNT(*)::int as c FROM students', []);
  return rows[0].c;
};

module.exports = {
  findByNim,
  updatePassword,
  resetPasswordByAdmin,
  insertIfNotExists,
  countAll,
};
