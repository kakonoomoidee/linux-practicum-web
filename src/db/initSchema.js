const fs = require('fs');
const path = require('path');
const { query } = require('./connection');
const logger = require('../config/logger');

async function initSchema() {
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8');
  await query(sql);
  logger.info('Schema database siap (tabel dibuat kalau belum ada)', { event: 'db_schema_ready' });
}

module.exports = { initSchema };
