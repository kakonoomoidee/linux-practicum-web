/**
 * Import daftar mahasiswa dari file CSV hasil export elearning (Moodle).
 *
 * Format CSV yang diharapkan (header wajib ada):
 *   nim,nama
 *   20220140020,Rizki Ramadan
 *
 * Cara pakai:
 *   node scripts/import-students.js path/ke/file.csv
 *
 * AMAN dijalankan berkali-kali: NIM yang sudah ada di-skip (tidak menimpa
 * password yang sudah diganti mahasiswa).
 */

const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
const { parse } = require('csv-parse/sync');
require('dotenv').config();

const { initSchema } = require('../src/db/initSchema');
const studentRepository = require('../src/repositories/studentRepository');
const config = require('../src/config/env');

async function main() {
  const filePath = process.argv[2];

  if (!filePath) {
    console.error('Usage: node scripts/import-students.js <path-to-csv>');
    process.exit(1);
  }

  const fullPath = path.resolve(filePath);
  if (!fs.existsSync(fullPath)) {
    console.error(`File tidak ditemukan: ${fullPath}`);
    process.exit(1);
  }

  await initSchema();

  const content = fs.readFileSync(fullPath, 'utf-8');
  const records = parse(content, { columns: true, skip_empty_lines: true, trim: true });

  if (records.length === 0) {
    console.error('File CSV kosong atau format tidak sesuai (butuh kolom: nim,nama)');
    process.exit(1);
  }

  const defaultHash = await bcrypt.hash(config.auth.defaultPassword, 12);

  let inserted = 0;
  let skipped = 0;

  for (const row of records) {
    const nim = (row.nim || '').trim();
    const nama = (row.nama || '').trim();

    if (!nim || !nama) {
      console.warn('Skip baris tidak lengkap:', row);
      continue;
    }

    const wasInserted = await studentRepository.insertIfNotExists(nim, nama, defaultHash);
    if (wasInserted) inserted++;
    else skipped++;
  }

  console.log(`\n✅ Import selesai.`);
  console.log(`   Baru ditambahkan : ${inserted}`);
  console.log(`   Sudah ada (skip) : ${skipped}`);
  console.log(`   Password default untuk akun baru: "${config.auth.defaultPassword}" (wajib diganti saat login pertama)\n`);
  process.exit(0);
}

main().catch((err) => {
  console.error('Import gagal:', err);
  process.exit(1);
});
