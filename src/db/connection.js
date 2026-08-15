const { Pool } = require('pg');
const config = require('../config/env');
const logger = require('../config/logger');

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
  logger.error(`Unexpected error pada idle client PostgreSQL: ${err.message}`, { stack: err.stack });
});

const query = (text, params) => pool.query(text, params);

module.exports = { pool, query };
