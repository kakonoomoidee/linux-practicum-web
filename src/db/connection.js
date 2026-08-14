const { Pool } = require('pg');
const config = require('../config/env');

const pool = new Pool(
  config.db.connectionString
    ? { connectionString: config.db.connectionString }
    : {
        host: config.db.host,
        port: config.db.port,
        user: config.db.user,
        password: config.db.password,
        database: config.db.database,
      }
);

pool.on('error', (err) => {
  // Error di koneksi idle di pool - jangan sampai crash seluruh proses
  console.error('[db] Unexpected error pada idle client:', err.message);
});

const query = (text, params) => pool.query(text, params);

module.exports = { pool, query };
