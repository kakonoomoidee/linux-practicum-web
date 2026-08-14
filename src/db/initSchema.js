const fs = require('fs');
const path = require('path');
const { query } = require('./connection');

async function initSchema() {
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8');
  await query(sql);
  console.log('[db] Schema siap (tabel dibuat kalau belum ada)');
}

module.exports = { initSchema };
