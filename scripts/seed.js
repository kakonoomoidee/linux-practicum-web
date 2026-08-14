/**
 * Seed script - AMAN dijalankan berkali-kali (idempotent).
 *
 * Yang dilakukan:
 * 1. Pastikan schema DB sudah ada.
 * 2. Bikin akun admin PERTAMA KALI SAJA. Kalau ADMIN_PASSWORD tidak diisi di .env,
 *    script ini akan GENERATE password random yang aman (bukan default lemah kayak
 *    "admin123") dan menampilkannya SEKALI SAJA di terminal - dicatat oleh kamu,
 *    setelah itu tidak akan bisa dilihat lagi (cuma hash yang tersimpan di DB).
 * 3. Kalau admin sudah ada sebelumnya, tidak akan ditimpa/direset otomatis
 *    (supaya seed aman dijalankan ulang tanpa sengaja mereset password admin).
 *
 * Cara pakai:
 *   node scripts/seed.js
 *   atau: npm run seed
 */

const crypto = require('crypto');
const bcrypt = require('bcrypt');
require('dotenv').config();

const { initSchema } = require('../src/db/initSchema');
const adminRepository = require('../src/repositories/adminRepository');
const config = require('../src/config/env');

function generateSecurePassword(length = 16) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#%*';
  const bytes = crypto.randomBytes(length);
  let pass = '';
  for (let i = 0; i < length; i++) pass += chars[bytes[i] % chars.length];
  return pass;
}

async function seedAdmin() {
  const username = config.admin.username;
  let password = config.admin.password;
  let wasGenerated = false;

  if (!password) {
    password = generateSecurePassword();
    wasGenerated = true;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const created = await adminRepository.insertIfNotExists(username, passwordHash);

  if (created) {
    console.log('\n✅ Akun admin berhasil dibuat.');
    console.log(`   Username : ${username}`);
    if (wasGenerated) {
      console.log(`   Password : ${password}`);
      console.log('   ⚠️  SIMPAN PASSWORD INI SEKARANG. Tidak akan ditampilkan lagi setelah ini.');
      console.log('   (Kalau lupa, hapus row-nya manual di tabel "admins" lalu jalankan seed ulang.)');
    } else {
      console.log('   Password : (sesuai ADMIN_PASSWORD di .env kamu)');
    }
  } else {
    console.log(`\nℹ️  Akun admin "${username}" sudah ada sebelumnya, tidak ditimpa (aman untuk dijalankan ulang).`);
  }
}

async function main() {
  console.log('🌱 Menjalankan seed...\n');

  try {
    await initSchema();
  } catch (err) {
    console.error('❌ Gagal konek ke PostgreSQL. Pastikan DB aktif dan .env sudah benar.');
    console.error(err.message);
    process.exit(1);
  }

  await seedAdmin();

  console.log('\n✅ Seed selesai.\n');
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Seed gagal:', err);
  process.exit(1);
});
